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
/** Intervalle entre deux analyses d'image — assez vif sans chauffer le téléphone. */
const SCAN_INTERVAL_MS = 120
/** Largeur maximale d'une image analysée (au-delà, plus lent sans lire mieux). */
const MAX_ANALYSIS_WIDTH = 1600

interface NativeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats?: () => Promise<string[]>
}

/** Une image (canvas) → les codes lus dedans. */
type FrameDecoder = (canvas: HTMLCanvasElement) => Promise<string[]>

export interface ScanRegion {
  /** Zone prise dans l'image de la caméra (pixels). */
  sx: number
  sy: number
  sw: number
  sh: number
  /** Taille de l'image analysée (la zone agrandie). */
  width: number
  height: number
}

/**
 * Zones analysées à tour de rôle : l'image entière, puis le centre (là où
 * est le cadre de visée) agrandi 2× et 3×. Un vrai produit tenu à 25-30 cm
 * donne un code petit et un peu flou : sans agrandissement, il n'y a qu'un
 * ou deux pixels par barre et ni le lecteur natif ni ZXing ne le lisent.
 */
export function scanRegions(videoWidth: number, videoHeight: number): ScanRegion[] {
  const region = (fw: number, fh: number, scale: number): ScanRegion => {
    const sw = Math.round(videoWidth * fw)
    const sh = Math.round(videoHeight * fh)
    const factor = Math.min(scale, MAX_ANALYSIS_WIDTH / sw)
    return {
      sx: Math.round((videoWidth - sw) / 2),
      sy: Math.round((videoHeight - sh) / 2),
      sw,
      sh,
      width: Math.round(sw * factor),
      height: Math.round(sh * factor),
    }
  }
  return [region(1, 1, 1), region(0.8, 0.5, 2), region(0.5, 0.35, 3)]
}

/**
 * Un code n'est rendu qu'une fois relu à l'identique : 2 fois, 3 pour un
 * code de 8 chiffres ou moins. Sur un code petit ou flou, un lecteur peut
 * « voir » un EAN-8 valide dans un morceau d'EAN-13 (vu en test :
 * 23228733 lu au lieu de 5449000000996) — une lecture isolée ne suffit
 * donc pas. Les lectures plus vieilles que `windowMs` sont oubliées.
 */
export function createReadConfirmer(windowMs = 2000, now: () => number = () => Date.now()) {
  const reads = new Map<string, { count: number; last: number }>()
  return (code: string): boolean => {
    const t = now()
    for (const [other, r] of reads) if (t - r.last > windowMs) reads.delete(other)
    const entry = reads.get(code) ?? { count: 0, last: t }
    entry.count += 1
    entry.last = t
    reads.set(code, entry)
    const needed = /^\d{1,8}$/.test(code) ? 3 : 2
    return entry.count === needed
  }
}

/** Boucle commune : chaque tour analyse la zone suivante de scanRegions(). */
function frameLoopReader(decode: FrameDecoder): CodeReader {
  let stopped = true
  let confirm = createReadConfirmer()
  let timer: ReturnType<typeof setTimeout> | null = null
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  const ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null
  let pass = 0
  return {
    start: async (video, onCode) => {
      stopped = false
      confirm = createReadConfirmer()
      const tick = async () => {
        if (stopped) return
        if (canvas && ctx && video.readyState >= 2 && video.videoWidth > 0) {
          const regions = scanRegions(video.videoWidth, video.videoHeight)
          const r = regions[pass % regions.length]
          pass++
          canvas.width = r.width
          canvas.height = r.height
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, r.width, r.height)
          try {
            for (const code of await decode(canvas)) if (!stopped && confirm(code)) onCode(code)
          } catch {
            // Rien lu sur cette image, ou détecteur occupé : on continue.
          }
        }
        if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS)
      }
      void tick()
    },
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}

async function nativeDecoder(): Promise<FrameDecoder | null> {
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
  return async (canvas) => (await detector.detect(canvas)).map((found) => found.rawValue)
}

async function zxingDecoder(): Promise<FrameDecoder> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map<(typeof DecodeHintType)[keyof typeof DecodeHintType], unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
    // Cherche aussi les codes penchés ou peu contrastés (un peu plus lent, toujours fluide).
    [DecodeHintType.TRY_HARDER, true],
  ])
  const reader = new BrowserMultiFormatReader(hints)
  return async (canvas) => {
    try {
      return [reader.decodeFromCanvas(canvas).getText()]
    } catch {
      return [] // Rien sur cette image (NotFoundException).
    }
  }
}

export async function createCodeReader(): Promise<CodeReader> {
  return frameLoopReader((await nativeDecoder()) ?? (await zxingDecoder()))
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      // Plus de pixels par barre = un code lu de plus loin.
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
    // Mise au point continue quand la caméra la propose (sinon un code proche reste flou).
    const track = stream.getVideoTracks()[0]
    const focusModes = (track?.getCapabilities?.() as { focusMode?: string[] } | undefined)?.focusMode
    if (focusModes?.includes('continuous')) {
      void track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined)
    }
    return stream
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

/**
 * Ignore un code relu moins de `windowMs` après la dernière fois qu'on l'a
 * vu (la caméra le voit plusieurs fois par seconde, une douchette peut
 * doubler l'Entrée). Mémoire PAR CODE : un article encore dans le champ
 * pendant qu'on en scanne un autre n'est pas ajouté une seconde fois.
 * Pour rescanner le même article, on l'écarte de la caméra 1,5 s.
 */
export function createDuplicateFilter(windowMs = 1500, now: () => number = () => Date.now()) {
  const lastSeen = new Map<string, number>()
  return (code: string): boolean => {
    const t = now()
    const previous = lastSeen.get(code)
    lastSeen.set(code, t)
    for (const [other, at] of lastSeen) if (t - at >= windowMs) lastSeen.delete(other)
    return previous === undefined || t - previous >= windowMs
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
