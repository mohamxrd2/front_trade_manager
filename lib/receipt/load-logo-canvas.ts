/**
 * Charge le logo de l'entreprise (URL) dans un canvas — préparation
 * nécessaire avant de le passer à encodeReceiptEscPos() (raster GS v 0).
 * Browser-only, non testable unitairement (Image/canvas) — `null` en cas
 * d'échec (CORS, logo introuvable…), jamais bloquant pour le reste du ticket.
 */
export async function loadLogoAsCanvas(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Logo prêt pour l'impression ESC/POS : redimensionné pour tenir dans
 * `maxWidth` × `maxHeight` points (sans agrandir), sur fond blanc, en
 * ImageData (RGBA) — l'encodeur le convertit en noir et blanc et le centre.
 * `null` en cas d'échec, jamais bloquant.
 */
export async function loadLogoImageData(url: string, maxWidth: number, maxHeight: number): Promise<ImageData | null> {
  const source = await loadLogoAsCanvas(url)
  if (!source || source.width === 0 || source.height === 0) return null
  const scale = Math.min(1, maxWidth / source.width, maxHeight / source.height)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  try {
    return ctx.getImageData(0, 0, width, height)
  } catch {
    // Canvas « teinté » (logo servi sans en-têtes CORS) : pas de logo.
    return null
  }
}

