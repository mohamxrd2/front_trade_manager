'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CameraOff, Flashlight, FlashlightOff, Keyboard, Loader2, RotateCcw, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { normalizeBarcode, validateBarcode } from '@/lib/barcode/validate'
import {
  cameraProblemOf,
  createCodeReader,
  createDuplicateFilter,
  openCamera,
  primeScanSound,
  scanFeedback,
  setTorch,
  stopStream,
  torchCapable,
  type CameraProblem,
  type CodeReader,
} from '@/lib/barcode/camera'

/** Ce que la page a fait du code (affiché et annoncé dans le scanner, qui reste ouvert en mode continu). */
export interface ScanOutcome {
  tone: 'success' | 'error'
  message: string
  detail?: string
  action?: { label: string; onSelect: () => void }
}

export interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** « continu » : vente, on enchaîne les articles ; « une fois » : formulaire, le scanner se ferme au premier code. */
  mode: 'continuous' | 'once'
  onDetected: (code: string) => void | ScanOutcome | Promise<void | ScanOutcome>
  title?: string
}

/** Événement de test (développement uniquement) : simule un code lu par la caméra. */
export const TEST_SCAN_EVENT = 'waelly:test-barcode-scan'

type CameraState = { status: 'starting' } | { status: 'running'; torch: boolean | null } | { status: 'problem'; problem: CameraProblem }

/**
 * Scanner de codes-barres : plein écran sur mobile, fenêtre sur ordinateur.
 * Caméra arrière, cadre de visée, lampe si disponible, bip + vibration,
 * même code ignoré 1,5 s. Caméra refusée ou absente : explication et saisie
 * à la main. La caméra s'arrête dès la fermeture (voyant éteint).
 */
export function BarcodeScanner({ open, onOpenChange, mode, onDetected, title }: BarcodeScannerProps) {
  const { t } = useTranslation()
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const readerRef = React.useRef<CodeReader | null>(null)
  const chainRef = React.useRef<Promise<void>>(Promise.resolve())
  const filterRef = React.useRef(createDuplicateFilter(1500))
  const onDetectedRef = React.useRef(onDetected)
  const openRef = React.useRef(open)
  React.useLayoutEffect(() => {
    onDetectedRef.current = onDetected
    openRef.current = open
  })

  const [camera, setCamera] = React.useState<CameraState>({ status: 'starting' })
  const [attempt, setAttempt] = React.useState(0)
  const [outcome, setOutcome] = React.useState<ScanOutcome | null>(null)
  const [announcement, setAnnouncement] = React.useState('')
  const [manual, setManual] = React.useState('')
  const [manualError, setManualError] = React.useState<string | null>(null)
  const [showManual, setShowManual] = React.useState(false)

  const stopCamera = React.useCallback(() => {
    readerRef.current?.stop()
    readerRef.current = null
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Un code à la fois, dans l'ordre (deux articles scannés vite ne se marchent pas dessus).
  const handleCode = React.useCallback(
    (raw: string, source: 'camera' | 'manual') => {
      const code = normalizeBarcode(raw)
      if (!code) return
      if (source === 'camera' && !filterRef.current(code)) return
      if (source === 'manual') filterRef.current(code)

      chainRef.current = chainRef.current.then(async () => {
        if (!openRef.current) return
        scanFeedback('ok')
        setAnnouncement(t('barcode.scanner.read', { code }))
        if (mode === 'once') {
          stopCamera()
          onOpenChange(false)
          await onDetectedRef.current(code)
          return
        }
        try {
          const result = await onDetectedRef.current(code)
          if (result) {
            if (result.tone === 'error') scanFeedback('error')
            setOutcome(result)
            setAnnouncement([result.message, result.detail].filter(Boolean).join('. '))
          }
        } catch {
          // La page affiche sa propre erreur.
        }
      })
    },
    [mode, onOpenChange, stopCamera, t]
  )

  React.useEffect(() => {
    if (!open) {
      stopCamera()
      return
    }
    let cancelled = false
    setCamera({ status: 'starting' })
    filterRef.current = createDuplicateFilter(1500)

    ;(async () => {
      try {
        const stream = await openCamera()
        if (cancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => undefined)
        const reader = await createCodeReader()
        if (cancelled) {
          stopStream(stream)
          return
        }
        readerRef.current = reader
        await reader.start(video, (code) => handleCode(code, 'camera'))
        if (!cancelled) setCamera({ status: 'running', torch: torchCapable(stream) ? false : null })
      } catch (error) {
        if (cancelled) return
        stopCamera()
        setCamera({ status: 'problem', problem: cameraProblemOf(error) })
        setShowManual(true)
      }
    })()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [open, attempt, handleCode, stopCamera])

  React.useEffect(() => {
    if (open) return
    setOutcome(null)
    setAnnouncement('')
    setManual('')
    setManualError(null)
    setShowManual(false)
  }, [open])

  // Développement : un test (Playwright) peut simuler un code lu par la caméra.
  React.useEffect(() => {
    if (!open || process.env.NODE_ENV === 'production') return
    const onTestScan = (event: Event) => handleCode(String((event as CustomEvent<string>).detail ?? ''), 'camera')
    window.addEventListener(TEST_SCAN_EVENT, onTestScan)
    return () => window.removeEventListener(TEST_SCAN_EVENT, onTestScan)
  }, [open, handleCode])

  const toggleTorch = async () => {
    if (camera.status !== 'running' || camera.torch === null) return
    const next = !camera.torch
    if (await setTorch(streamRef.current, next)) setCamera({ status: 'running', torch: next })
  }

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateBarcode(manual)
    if (!result.ok) {
      setManualError(t(`barcode.scanner.invalid.${result.error}`))
      return
    }
    setManualError(null)
    setManual('')
    handleCode(manual, 'manual')
  }

  const heading = title ?? (mode === 'continuous' ? t('barcode.scanner.titleContinuous') : t('barcode.scanner.title'))
  const problem = camera.status === 'problem' ? camera.problem : null

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (next) primeScanSound()
        onOpenChange(next)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby="barcode-scanner-hint"
          className={cn(
            'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black text-white outline-none',
            // Ordinateur : la fenêtre ne dépasse jamais l'écran ; la caméra rétrécit et le contenu défile si besoin.
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92dvh] sm:w-[min(560px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-y-auto sm:overscroll-contain sm:rounded-panel sm:shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none'
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-base font-bold">{heading}</DialogPrimitive.Title>
              <DialogPrimitive.Description id="barcode-scanner-hint" className="text-[13px] text-white/70">
                {mode === 'continuous' ? t('barcode.scanner.hintContinuous') : t('barcode.scanner.hint')}
              </DialogPrimitive.Description>
            </div>
            {camera.status === 'running' && camera.torch !== null ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-pressed={camera.torch}
                aria-label={camera.torch ? t('barcode.scanner.torchOff') : t('barcode.scanner.torchOn')}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  camera.torch ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'
                )}
              >
                {camera.torch ? <Flashlight className="size-5" aria-hidden="true" /> : <FlashlightOff className="size-5" aria-hidden="true" />}
              </button>
            ) : null}
            <DialogPrimitive.Close
              aria-label={t('barcode.scanner.close')}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </header>

          {/* --- Caméra et cadre de visée --- */}
          <div className="relative min-h-[180px] flex-1 overflow-hidden bg-black sm:h-[min(420px,45dvh)] sm:flex-none">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              aria-hidden="true"
              className={cn('absolute inset-0 size-full object-cover', problem && 'hidden')}
            />
            {problem ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto px-6 text-center">
                <CameraOff className="size-10 text-white/70" aria-hidden="true" />
                <p className="text-base font-bold">{t(`barcode.scanner.problem.${problem}.title`)}</p>
                <p className="max-w-sm text-sm leading-relaxed text-white/75">{t(`barcode.scanner.problem.${problem}.body`)}</p>
                {problem !== 'unsupported' && problem !== 'no-camera' ? (
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {t('barcode.scanner.retry')}
                  </button>
                ) : null}
              </div>
            ) : (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-[34%] max-h-48 w-[78%] max-w-sm rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <span className="absolute -left-0.5 -top-0.5 size-7 rounded-tl-2xl border-l-4 border-t-4 border-white" />
                  <span className="absolute -right-0.5 -top-0.5 size-7 rounded-tr-2xl border-r-4 border-t-4 border-white" />
                  <span className="absolute -bottom-0.5 -left-0.5 size-7 rounded-bl-2xl border-b-4 border-l-4 border-white" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-7 rounded-br-2xl border-b-4 border-r-4 border-white" />
                  <span className="scanner-laser absolute inset-x-4 top-1/2 h-0.5 rounded-full bg-danger-dot/90" />
                </div>
                {camera.status === 'starting' ? (
                  <span className="absolute bottom-6 inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    {t('barcode.scanner.starting')}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* --- Résultat du dernier code, saisie manuelle --- */}
          <footer className="flex shrink-0 flex-col gap-3 bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <p role="status" aria-live="assertive" className="sr-only">
              {announcement}
            </p>
            {outcome ? (
              <div
                data-scan-outcome={outcome.tone}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3',
                  outcome.tone === 'success' ? 'bg-success/25' : 'bg-danger-dot/25'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{outcome.message}</p>
                  {outcome.detail ? <p className="text-[13px] text-white/80">{outcome.detail}</p> : null}
                </div>
                {outcome.action ? (
                  <button
                    type="button"
                    onClick={outcome.action.onSelect}
                    className="inline-flex h-10 shrink-0 items-center rounded-full bg-white px-4 text-sm font-bold text-black hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {outcome.action.label}
                  </button>
                ) : null}
              </div>
            ) : null}

            {showManual ? (
              <form onSubmit={submitManual} className="flex flex-col gap-1.5" noValidate>
                <label htmlFor="barcode-manual" className="text-[13px] font-semibold text-white/80">
                  {t('barcode.scanner.manualLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="barcode-manual"
                    value={manual}
                    onChange={(e) => {
                      setManual(e.target.value)
                      setManualError(null)
                    }}
                    inputMode="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder={t('barcode.scanner.manualPlaceholder')}
                    aria-invalid={manualError ? true : undefined}
                    aria-describedby={manualError ? 'barcode-manual-error' : undefined}
                    autoFocus={problem !== null}
                    className="h-12 min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 font-mono text-base tracking-wide text-white outline-none placeholder:text-white/40 focus:border-white"
                  />
                  <button
                    type="submit"
                    className="h-12 shrink-0 rounded-full bg-white px-5 text-sm font-bold text-black hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {t('barcode.scanner.manualSubmit')}
                  </button>
                </div>
                {manualError ? (
                  <p id="barcode-manual-error" className="text-[13px] font-semibold text-red-300">
                    {manualError}
                  </p>
                ) : null}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="inline-flex h-11 items-center justify-center gap-2 self-center rounded-full px-4 text-sm font-semibold text-white/85 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Keyboard className="size-4" aria-hidden="true" />
                {t('barcode.scanner.manualLabel')}
              </button>
            )}

            {mode === 'continuous' ? (
              <DialogPrimitive.Close className="h-12 rounded-full bg-brand-500 text-base font-bold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {t('barcode.scanner.done')}
              </DialogPrimitive.Close>
            ) : null}
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
