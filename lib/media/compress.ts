/**
 * Compression des images AVANT l'envoi — le plus gros gain sur une
 * connexion mobile : une photo de téléphone de 4 Mo part en ~150 Ko.
 *
 * Redimensionnement (1200 px articles, 512 px logo et photos de profil),
 * WebP qualité ~0,8 (JPEG si le navigateur ne sait pas produire du WebP),
 * orientation EXIF appliquée au décodage, et métadonnées (GPS compris)
 * perdues : on ne renvoie que les pixels redessinés sur un canvas.
 * Le serveur ré-encode de toute façon (voir MediaService côté Laravel).
 */

export type MediaKind = 'product' | 'variation' | 'logo' | 'avatar'

export interface MediaPreset {
  /** Côté le plus long, en pixels. */
  maxSize: number
  /** Taille visée, en octets. */
  targetBytes: number
}

export const MEDIA_PRESETS: Record<MediaKind, MediaPreset> = {
  product: { maxSize: 1200, targetBytes: 300 * 1024 },
  variation: { maxSize: 1200, targetBytes: 300 * 1024 },
  logo: { maxSize: 512, targetBytes: 100 * 1024 },
  avatar: { maxSize: 512, targetBytes: 100 * 1024 },
}

export const ACCEPTED_INPUT_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'

const START_QUALITY = 0.8
const MIN_QUALITY = 0.5

/** Dimensions qui tiennent dans maxSize × maxSize, proportions gardées, jamais agrandies. */
export function fitWithin(width: number, height: number, maxSize: number): { width: number; height: number } {
  const ratio = Math.min(1, maxSize / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

/** Carré centré le plus grand possible (recadrage des logos et photos de profil). */
export function centerSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height)
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size }
}

export interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
}

export interface CompressDeps {
  decode: (file: Blob) => Promise<DecodedImage>
  /** Dessine `source` (zone sx,sy,sw,sh) sur un canvas width×height et l'encode. */
  render: (
    image: DecodedImage,
    crop: { sx: number; sy: number; sw: number; sh: number },
    width: number,
    height: number,
    type: string,
    quality: number
  ) => Promise<Blob | null>
}

export interface CompressedImage {
  blob: Blob
  width: number
  height: number
  type: 'image/webp' | 'image/jpeg'
}

export class ImageUnreadableError extends Error {
  constructor() {
    super('image_unreadable')
  }
}

/**
 * Compresse `file` pour `kind`. Baisse la qualité (jusqu'à 0,5) puis la
 * taille si l'objectif n'est pas atteint ; s'arrête au meilleur essai.
 */
export async function compressImage(
  file: Blob,
  kind: MediaKind,
  options: { square?: boolean } = {},
  deps: CompressDeps = browserDeps
): Promise<CompressedImage> {
  let image: DecodedImage
  try {
    image = await deps.decode(file)
  } catch {
    throw new ImageUnreadableError()
  }

  try {
    const { maxSize, targetBytes } = MEDIA_PRESETS[kind]
    const square = options.square ? centerSquare(image.width, image.height) : null
    const crop = square
      ? { sx: square.sx, sy: square.sy, sw: square.size, sh: square.size }
      : { sx: 0, sy: 0, sw: image.width, sh: image.height }

    let size = fitWithin(crop.sw, crop.sh, maxSize)
    let type: CompressedImage['type'] = 'image/webp'
    let best: CompressedImage | null = null

    for (let attempt = 0; attempt < 8; attempt++) {
      const quality = Math.max(MIN_QUALITY, START_QUALITY - attempt * 0.1)
      let blob = await deps.render(image, crop, size.width, size.height, type, quality)
      // Safari ancien : toBlob('image/webp') rend un PNG. On passe en JPEG.
      if (blob && type === 'image/webp' && blob.type !== 'image/webp') {
        type = 'image/jpeg'
        blob = await deps.render(image, crop, size.width, size.height, type, quality)
      }
      if (!blob) throw new ImageUnreadableError()

      const result: CompressedImage = { blob, width: size.width, height: size.height, type }
      if (!best || blob.size < best.blob.size) best = result
      if (blob.size <= targetBytes) return result

      if (quality <= MIN_QUALITY) {
        size = fitWithin(size.width, size.height, Math.round(Math.max(size.width, size.height) * 0.8))
      }
    }

    return best as CompressedImage
  } finally {
    image.close?.()
  }
}

/* ---------- Navigateur ---------- */

async function decodeInBrowser(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Applique l'orientation EXIF (photo prise en portrait sur téléphone).
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // Repli : <img>, qui applique aussi l'orientation EXIF (image-orientation: from-image).
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function renderInBrowser(
  image: DecodedImage,
  crop: { sx: number; sy: number; sw: number; sh: number },
  width: number,
  height: number,
  type: string,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  if (type === 'image/jpeg') {
    // Pas de transparence en JPEG : fond blanc plutôt que noir.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image.source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export const browserDeps: CompressDeps = { decode: decodeInBrowser, render: renderInBrowser }
