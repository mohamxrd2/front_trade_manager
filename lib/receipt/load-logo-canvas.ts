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
