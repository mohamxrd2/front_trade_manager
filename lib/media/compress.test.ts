import { describe, expect, test } from 'vitest'

import { centerSquare, compressImage, fitWithin, ImageUnreadableError, MEDIA_PRESETS, type CompressDeps } from './compress'

/**
 * Faux canvas : la taille du « fichier » produit dépend des pixels et de
 * la qualité, comme un vrai encodeur. `webp: false` imite un navigateur
 * qui ne sait pas produire du WebP (toBlob rend alors un PNG).
 */
function fakeDeps(
  source: { width: number; height: number },
  { bytesPerPixel = 0.5, webp = true }: { bytesPerPixel?: number; webp?: boolean } = {}
) {
  const calls: Array<{ crop: { sx: number; sy: number; sw: number; sh: number }; width: number; height: number; type: string; quality: number }> = []
  let closed = false
  const deps: CompressDeps = {
    decode: async () => ({ source: {} as CanvasImageSource, ...source, close: () => void (closed = true) }),
    render: async (_image, crop, width, height, type, quality) => {
      calls.push({ crop, width, height, type, quality })
      const outType = type === 'image/webp' && !webp ? 'image/png' : type
      const size = Math.round(width * height * bytesPerPixel * quality)
      return new Blob([new Uint8Array(size)], { type: outType })
    },
  }
  return { deps, calls, isClosed: () => closed }
}

describe('dimensions', () => {
  test('tient dans le maximum, proportions gardées, jamais agrandie', () => {
    expect(fitWithin(4032, 3024, 1200)).toEqual({ width: 1200, height: 900 })
    expect(fitWithin(3024, 4032, 512)).toEqual({ width: 384, height: 512 })
    expect(fitWithin(300, 200, 1200)).toEqual({ width: 300, height: 200 })
  })

  test('carré centré', () => {
    expect(centerSquare(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 })
    expect(centerSquare(300, 500)).toEqual({ sx: 0, sy: 100, size: 300 })
  })
})

describe('compressImage', () => {
  test('photo d’article de téléphone → WebP 1200 px, sous 300 Ko', async () => {
    const { deps, calls, isClosed } = fakeDeps({ width: 4032, height: 3024 })
    const result = await compressImage(new Blob(), 'product', {}, deps)

    expect(result.type).toBe('image/webp')
    expect([result.width, result.height]).toEqual([1200, 900])
    expect(result.blob.size).toBeLessThanOrEqual(MEDIA_PRESETS.product.targetBytes)
    expect(calls[0]).toMatchObject({ type: 'image/webp', quality: 0.8 })
    expect(isClosed()).toBe(true)
  })

  test('logo → 512 px max, sous 100 Ko, en baissant la qualité si besoin', async () => {
    const { deps, calls } = fakeDeps({ width: 2000, height: 2000 }, { bytesPerPixel: 0.6 })
    const result = await compressImage(new Blob(), 'logo', {}, deps)

    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(512)
    expect(result.blob.size).toBeLessThanOrEqual(MEDIA_PRESETS.logo.targetBytes)
    expect(calls.length).toBeGreaterThan(1)
    expect(calls.at(-1)!.quality).toBeLessThan(0.8)
  })

  test('réduit la taille quand la qualité minimale ne suffit pas', async () => {
    const { deps, calls } = fakeDeps({ width: 512, height: 512 }, { bytesPerPixel: 2 })
    const result = await compressImage(new Blob(), 'avatar', {}, deps)

    expect(result.blob.size).toBeLessThanOrEqual(MEDIA_PRESETS.avatar.targetBytes)
    expect(result.width).toBeLessThan(512)
    expect(calls.every((c) => c.quality >= 0.5)).toBe(true)
  })

  test('recadrage carré facultatif pour les logos et photos de profil', async () => {
    const { deps, calls } = fakeDeps({ width: 4000, height: 3000 })
    const result = await compressImage(new Blob(), 'avatar', { square: true }, deps)

    expect(calls[0].crop).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 })
    expect(result.width).toBe(result.height)
  })

  test('repli JPEG quand le navigateur ne produit pas de WebP', async () => {
    const { deps } = fakeDeps({ width: 1000, height: 800 }, { webp: false })
    const result = await compressImage(new Blob(), 'product', {}, deps)

    expect(result.type).toBe('image/jpeg')
    expect(result.blob.type).toBe('image/jpeg')
  })

  test('fichier illisible (pas une image) → ImageUnreadableError', async () => {
    const deps: CompressDeps = {
      decode: async () => {
        throw new Error('decode failed')
      },
      render: async () => null,
    }
    await expect(compressImage(new Blob(['pas une image']), 'product', {}, deps)).rejects.toBeInstanceOf(ImageUnreadableError)
  })
})
