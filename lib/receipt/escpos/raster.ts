import QRCode from 'qrcode'

/**
 * Images pour l'impression ESC/POS — logo et QR code imprimés en image
 * « raster » (GS v 0), la commande d'image la plus largement supportée.
 *
 * Le QR code n'utilise plus la commande native GS ( k : sur l'imprimante
 * réelle, un de ses paramètres (« 2 », le modèle de QR) sortait comme du
 * texte sous le message de bas de ticket.
 */

/** Image RGBA, comme ImageData (navigateur) — testable sans canvas. */
export interface ImageDataLike {
  width: number
  height: number
  data: Uint8ClampedArray | Uint8Array | number[]
}

/** Image 1 bit : `rows[y][x]` vrai = point noir. */
export interface MonoBitmap {
  width: number
  height: number
  pixels: boolean[][]
}

/** Largeur imprimable en points : 384 (58 mm) ou 576 (80 mm). */
export function printerDotsFor(width: '58mm' | '80mm'): number {
  return width === '80mm' ? 576 : 384
}

/** RGBA → noir/blanc (tramage Floyd-Steinberg ; transparent = blanc). */
export function toMonochrome(image: ImageDataLike): MonoBitmap {
  const { width, height, data } = image
  const lum = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const a = data[i * 4 + 3] / 255
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = gray * a + 255 * (1 - a)
  }
  const pixels: boolean[][] = []
  for (let y = 0; y < height; y++) {
    const row: boolean[] = []
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const old = lum[i]
      const black = old < 128
      row.push(black)
      const err = old - (black ? 0 : 255)
      if (x + 1 < width) lum[i + 1] += (err * 7) / 16
      if (y + 1 < height) {
        if (x > 0) lum[i + width - 1] += (err * 3) / 16
        lum[i + width] += (err * 5) / 16
        if (x + 1 < width) lum[i + width + 1] += err / 16
      }
    }
    pixels.push(row)
  }
  return { width, height, pixels }
}

/** QR code → image 1 bit, `moduleDots` points par module, marge de 4 modules. */
export function qrBitmap(payload: string, moduleDots: number): MonoBitmap {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const size = qr.modules.size
  const quiet = 4
  const total = (size + quiet * 2) * moduleDots
  const pixels: boolean[][] = []
  for (let y = 0; y < total; y++) {
    const my = Math.floor(y / moduleDots) - quiet
    const row: boolean[] = []
    for (let x = 0; x < total; x++) {
      const mx = Math.floor(x / moduleDots) - quiet
      row.push(my >= 0 && my < size && mx >= 0 && mx < size && Boolean(qr.modules.get(my, mx)))
    }
    pixels.push(row)
  }
  return { width: total, height: total, pixels }
}

/**
 * Commandes GS v 0 pour une image, centrée sur toute la largeur du papier
 * (sans compter sur ESC a, ignoré par certaines imprimantes pour les
 * images), découpée en BANDES : chaque commande, en-tête compris, tient
 * dans `maxCommandBytes` — le découpage en paquets Bluetooth ne coupe donc
 * jamais une commande d'image en deux.
 *
 * GS v 0 : 1D 76 30 m xL xH yL yH d1…dk — m = 0 (taille normale),
 * x = octets par ligne, y = nombre de lignes, 1 bit par point (MSB à gauche).
 */
export function rasterCommands(bitmap: MonoBitmap, paperDots: number, maxCommandBytes: number): Uint8Array[] {
  const bytesPerRow = Math.ceil(paperDots / 8)
  const offsetX = Math.max(0, Math.floor((paperDots - bitmap.width) / 2))
  const rowsPerBand = Math.max(1, Math.floor((maxCommandBytes - 8) / bytesPerRow))
  const commands: Uint8Array[] = []

  for (let top = 0; top < bitmap.height; top += rowsPerBand) {
    const rows = Math.min(rowsPerBand, bitmap.height - top)
    const command = new Uint8Array(8 + bytesPerRow * rows)
    command.set([0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff])
    for (let r = 0; r < rows; r++) {
      const source = bitmap.pixels[top + r]
      for (let x = 0; x < bitmap.width && offsetX + x < bytesPerRow * 8; x++) {
        if (!source[x]) continue
        const px = offsetX + x
        command[8 + r * bytesPerRow + (px >> 3)] |= 0x80 >> (px & 7)
      }
    }
    commands.push(command)
  }
  return commands
}
