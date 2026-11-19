/**
 * Lecture de codes-barres par la caméra.
 * - BarcodeDetector (natif : Chrome Android, Edge…) quand il gère les EAN ;
 * - sinon ZXing (@zxing/browser, chargé à la demande) : iPhone/Safari, Firefox.
 * Formats : EAN-13, EAN-8, UPC-A, UPC-E, Code 128.
 */

export type CameraProblem = 'denied' | 'no-camera' | 'in-use' | 'unsupported' | 'unknown'

export interface CodeReader {
  /** Lance la lecture sur la vidéo ; `onCode` à chaque code vu (doublons compris). */
  start: (video: HTMLVideoElement, onCode: (code: string) => void) => Promise<void>
  stop: () => void
}

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
/** Intervalle entre deux analyses d'image (natif) — assez vif sans chauffer le téléphone. */
const NATIVE_INTERVAL_MS = 120

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats?: () => Promise<string[]>
}

export class CameraError extends Error {
  constructor(public readonly problem: CameraProblem) {
    super(problem)
  }
}

export function cameraProblemOf(error: unknown): CameraProblem {
  if (error instanceof CameraError) return error.problem
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'no-camera'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'in-use'
  return 'unknown'
}

/** Caméra arrière de préférence. Lève une CameraError en cas d'échec. */
export async function openCamera(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unsupported')
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
  } catch (error) {
    throw new CameraError(cameraProblemOf(error))
  }
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop())
}

/** La caméra a-t-elle une lampe torche pilotable ? */
export function torchCapable(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0]
  const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
  return Boolean(capabilities?.torch)
}

export async function setTorch(stream: MediaStream | null, on: boolean): Promise<boolean> {
  const track = stream?.getVideoTracks()[0]
  if (!track) return false
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
    return true
  } catch {
    return false
  }
}

async function nativeReader(): Promise<CodeReader | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (!Detector) return null
  let formats = NATIVE_FORMATS
  try {
    const supported = (await Detector.getSupportedFormats?.()) ?? NATIVE_FORMATS
    formats = NATIVE_FORMATS.filter((f) => supported.includes(f))
  } catch {
    return null
  }
  if (!formats.includes('ean_13')) return null
  const detector = new Detector({ formats })

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    start: async (video, onCode) => {
      stopped = false
      const tick = async () => {
        if (stopped) return
        if (video.readyState >= 2) {
          try {
            for (const found of await detector.detect(video)) onCode(found.rawValue)
          } catch {
            // Image pas prête ou détecteur occupé : on réessaie au tour suivant.
          }
        }
        if (!stopped) timer = setTimeout(tick, NATIVE_INTERVAL_MS)
      }
      void tick()
    },
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}

async function zxingReader(): Promise<CodeReader> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map<(typeof DecodeHintType)[keyof typeof DecodeHintType], unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
  ])
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 300 })
  let controls: { stop: () => void } | null = null
  let stopped = false
  return {
    start: async (video, onCode) => {
      stopped = false
      const started = await reader.decodeFromVideoElement(video, (result) => {
        if (result) onCode(result.getText())
      })
      // Fermé pendant le démarrage : on arrête tout de suite.
      if (stopped) started.stop()
      else controls = started
    },
    stop: () => {
      stopped = true
      controls?.stop()
      controls = null
    },
  }
}

export async function createCodeReader(): Promise<CodeReader> {
  return (await nativeReader()) ?? zxingReader()
}

/**
 * Ignore le même code relu pendant `windowMs` (la caméra le voit plusieurs
 * fois par seconde, une douchette peut doubler l'Entrée). Un autre code
 * passe tout de suite.
 */
export function createDuplicateFilter(windowMs = 1500, now: () => number = () => Date.now()) {
  let lastCode: string | null = null
  let lastAt = -Infinity
  return (code: string): boolean => {
    const t = now()
    if (code === lastCode && t - lastAt < windowMs) {
      lastAt = t
      return false
    }
    lastCode = code
    lastAt = t
    return true
  }
}

let audioContext: AudioContext | null = null

/** Petit bip de confirmation (Web Audio, aucun fichier) + vibration courte si possible. */
export function scanFeedback(kind: 'ok' | 'error' = 'ok'): void {
  try {
    const AudioCtx = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      audioContext ??= new AudioCtx()
      const ctx = audioContext
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = kind === 'ok' ? 1760 : 330
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'ok' ? 0.09 : 0.25))
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start()
      oscillator.stop(ctx.currentTime + (kind === 'ok' ? 0.1 : 0.26))
    }
  } catch {
    // Son indisponible : la vibration et le message suffisent.
  }
  try {
    navigator.vibrate?.(kind === 'ok' ? 60 : [80, 60, 80])
  } catch {
    // Best-effort.
  }
}

/** À appeler pendant un geste (ouverture du scanner) : Safari ne joue un son que si le contexte audio a été créé par un geste. */
export function primeScanSound(): void {
  try {
    const AudioCtx = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      audioContext ??= new AudioCtx()
      void audioContext.resume()
    }
  } catch {
    // Best-effort.
  }
}
