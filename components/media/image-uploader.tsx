'use client'

import * as React from 'react'
import { Camera, ImageIcon, ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { ACCEPTED_INPUT_TYPES, compressImage, ImageUnreadableError, type CompressedImage, type MediaKind } from '@/lib/media/compress'
import { removeMedia, uploadMedia, type MediaUploadError, type UploadedMedia } from '@/lib/media/upload'
import { createUploadRunner, type UploadState } from '@/lib/media/upload-state'
import { MediaImage } from './media-image'

interface ImageUploaderProps {
  kind: MediaKind
  /**
   * Élément à qui rattacher l'image (article, variation, membre…). `undefined`
   * pour la photo d'un article pas encore créé : l'image est envoyée seule et
   * son id est passé à la création (onChange). `"me"` : sa propre photo.
   */
  ownerId?: string
  /** Image actuelle (URL) ou null. */
  value: string | null | undefined
  /** Appelé après un envoi réussi (image) ou un retrait (null). */
  onChange?: (media: UploadedMedia | null) => void
  /** Nom affiché (alt de l'image) et repli quand il n'y a pas d'image. */
  alt: string
  fallback?: React.ReactNode
  shape?: 'rounded' | 'circle'
  /** Classes de la vignette (taille). */
  previewClassName?: string
  /** Mise en page : vignette à gauche (row) ou au-dessus (column). */
  layout?: 'row' | 'column'
  disabled?: boolean
  className?: string
  /**
   * « compact » : vignette seule (lignes de variations). Toucher pour choisir
   * (le sélecteur du téléphone propose aussi l'appareil photo), progression,
   * « Réessayer » et « Retirer » en surimpression.
   */
  variant?: 'full' | 'compact'
}

const SQUARE_KINDS: MediaKind[] = ['logo', 'avatar']

/**
 * Envoi d'une image, commun à l'ordinateur et au mobile. L'image est
 * compressée dans le navigateur (lib/media/compress.ts) puis envoyée avec
 * une barre de progression ; en cas de coupure, « Réessayer » renvoie la
 * même image sans la recompresser. Sur mobile : « Prendre une photo »
 * (appareil photo arrière) ou « Choisir dans la galerie ».
 */
export function ImageUploader({
  kind,
  ownerId,
  value,
  onChange,
  alt,
  fallback,
  shape = 'rounded',
  previewClassName = 'size-24',
  layout = 'row',
  disabled = false,
  className,
  variant = 'full',
}: ImageUploaderProps) {
  const { t } = useTranslation()
  const inputId = React.useId()
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const galleryRef = React.useRef<HTMLInputElement>(null)
  const [state, setState] = React.useState<UploadState>({ status: 'idle' })
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [square, setSquare] = React.useState(kind === 'avatar')
  const [removing, setRemoving] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)

  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  })

  const runner = React.useMemo(
    () =>
      createUploadRunner(
        (image: CompressedImage, onProgress) => uploadMedia({ blob: image.blob, kind, ownerId, onProgress }),
        setState
      ),
    [kind, ownerId]
  )

  // L'aperçu local (blob:) est libéré dès qu'il n'est plus affiché.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const busy = state.status === 'compressing' || state.status === 'uploading' || removing
  const shown = preview ?? value ?? null
  const hasImage = !!shown

  const handleFile = async (file: File | undefined | null) => {
    if (!file || disabled) return
    setLocalError(null)
    setState({ status: 'compressing' })
    let image: CompressedImage
    try {
      image = await compressImage(file, kind, { square: SQUARE_KINDS.includes(kind) && square })
    } catch (error) {
      setState({ status: 'idle' })
      setLocalError(error instanceof ImageUnreadableError ? t('media.errors.unreadable') : t('media.errors.invalid'))
      return
    }
    setPreview(URL.createObjectURL(image.blob))
    const media = await runner.start(image)
    if (media) onChangeRef.current?.(media)
  }

  const handleRemove = async () => {
    if (busy || disabled) return
    setLocalError(null)
    runner.cancel()
    // Photo d'un article pas encore créé : rien n'est rattaché côté serveur.
    if (ownerId) {
      setRemoving(true)
      try {
        await removeMedia(kind, ownerId)
      } catch (error) {
        setRemoving(false)
        setLocalError(t((error as MediaUploadError).messageKey ?? 'media.errors.server'))
        return
      }
      setRemoving(false)
    }
    setPreview(null)
    onChangeRef.current?.(null)
  }

  const pick = (input: React.RefObject<HTMLInputElement | null>) => {
    if (input.current) {
      input.current.value = ''
      input.current.click()
    }
  }

  const errorMessage = localError ?? (state.status === 'error' ? t(state.error.messageKey) : null)
  const canRetry = state.status === 'error' && state.error.retryable

  const buttonClass =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft disabled:opacity-60'

  const hiddenInputs = (
    <>
      <input
        ref={cameraRef}
        id={`${inputId}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        id={`${inputId}-gallery`}
        type="file"
        accept={ACCEPTED_INPUT_TYPES}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </>
  )

  if (variant === 'compact') {
    const progress = state.status === 'uploading' ? state.progress : null
    return (
      <div className={cn('relative shrink-0', className)}>
        <button
          type="button"
          onClick={() => (canRetry ? void runner.retry().then((m) => m && onChangeRef.current?.(m)) : pick(galleryRef))}
          disabled={disabled || busy}
          aria-label={canRetry ? `${t('media.retry')} · ${alt}` : hasImage ? `${t('media.change')} · ${alt}` : `${t('media.choose')} · ${alt}`}
          title={errorMessage ?? undefined}
          className={cn(
            'relative flex items-center justify-center overflow-hidden border border-dashed border-line-strong bg-surface-soft text-ink-3',
            shape === 'circle' ? 'rounded-full' : 'rounded-[12px]',
            hasImage && 'border-solid',
            errorMessage && 'border-solid border-danger',
            previewClassName
          )}
        >
          <MediaImage src={shown} alt={alt} sizes="64px" className="size-full" fallback={fallback ?? <ImagePlus className="size-4" aria-hidden="true" />} />
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-bold text-white">
              {progress !== null ? `${progress}%` : <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            </span>
          ) : canRetry ? (
            <span className="absolute inset-0 flex items-center justify-center bg-danger/80 text-white">
              <RotateCcw className="size-4" aria-hidden="true" />
            </span>
          ) : null}
        </button>
        {hasImage && !busy ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label={`${t('media.remove')} · ${alt}`}
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-white after:absolute after:-inset-3"
          >
            <Trash2 className="size-3" aria-hidden="true" />
          </button>
        ) : null}
        {progress !== null ? (
          <span role="progressbar" aria-label={t('media.progressLabel')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="sr-only" />
        ) : null}
        <span role="alert" className="sr-only">
          {errorMessage}
        </span>
        {hiddenInputs}
      </div>
    )
  }

  return (
    <div className={cn('flex gap-4', layout === 'column' ? 'flex-col items-start' : 'flex-wrap items-center', className)}>
      {/* Vignette : cliquable et zone de dépôt sur ordinateur. */}
      <button
        type="button"
        onClick={() => pick(galleryRef)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        disabled={disabled || busy}
        aria-label={hasImage ? `${t('media.change')} · ${alt}` : t('media.choose')}
        className={cn(
          'relative shrink-0 overflow-hidden border border-dashed border-line-strong bg-surface-soft text-ink-3 transition-colors',
          shape === 'circle' ? 'rounded-full' : 'rounded-tile',
          hasImage && 'border-solid',
          dragOver && 'border-brand-500 bg-brand-50',
          previewClassName
        )}
      >
        <MediaImage
          src={shown}
          alt={alt}
          sizes="160px"
          className="size-full"
          fallback={fallback ?? <ImageIcon className="size-6" aria-hidden="true" />}
        />
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {/* Mobile : appareil photo ou galerie. Ordinateur : un seul bouton (+ dépôt). */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => pick(cameraRef)} disabled={disabled || busy} className={cn(buttonClass, 'md:hidden')}>
            <Camera className="size-4" aria-hidden="true" />
            {t('media.takePhoto')}
          </button>
          <button type="button" onClick={() => pick(galleryRef)} disabled={disabled || busy} className={cn(buttonClass, 'md:hidden')}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {hasImage ? t('media.change') : t('media.gallery')}
          </button>
          <button type="button" onClick={() => pick(galleryRef)} disabled={disabled || busy} className={cn(buttonClass, 'hidden md:inline-flex')}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {hasImage ? t('media.change') : t('media.choose')}
          </button>
          {hasImage ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled || busy}
              className={cn(buttonClass, 'border-transparent text-danger-strong hover:bg-danger-bg')}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t('media.remove')}
            </button>
          ) : null}
        </div>

        {!hasImage ? <p className="hidden text-xs text-ink-3 md:block">{t('media.dropHint')} · {t('media.formats')}</p> : null}

        {SQUARE_KINDS.includes(kind) ? (
          <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={square}
              onChange={(e) => setSquare(e.target.checked)}
              disabled={disabled || busy}
              className="size-5 accent-brand-600"
            />
            {t('media.squareCrop')}
          </label>
        ) : null}

        <div aria-live="polite" className="flex flex-col gap-2">
          {state.status === 'compressing' ? <p className="text-xs text-ink-3">{t('media.preparing')}</p> : null}
          {state.status === 'uploading' ? (
            <div className="flex flex-col gap-1.5">
              <div
                role="progressbar"
                aria-label={t('media.progressLabel')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={state.progress}
                className="h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-line"
              >
                <div className="h-full rounded-full bg-brand-600 transition-[width] duration-150" style={{ width: `${state.progress}%` }} />
              </div>
              <p className="text-xs text-ink-3">{t('media.uploading', { progress: state.progress })}</p>
            </div>
          ) : null}
        </div>

        {errorMessage ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-danger-strong">
            <span>{errorMessage}</span>
            {canRetry ? (
              <button type="button" onClick={() => void runner.retry().then((m) => m && onChangeRef.current?.(m))} className={buttonClass}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {t('media.retry')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {hiddenInputs}
    </div>
  )
}
