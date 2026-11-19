import type { MonoBitmap } from '@/lib/receipt/escpos/raster'
import { computeLabelLayout, type LabelBarcodeSize, type LabelLayout, type LabelText, type MeasureText } from './label-layout'
import { encodeBarcode, type EncodedBarcode } from './symbology'

/**
 * Dessin de l'étiquette au point d'imprimante près (navigateur : canvas).
 * Les mêmes images servent à l'aperçu, au partage et à l'impression.
 */

const FONT_FAMILY = 'Arial, Helvetica, "Liberation Sans", sans-serif' // i18n:allow — nom de police, pas un texte affiché
/** Marge blanche autour de l'étiquette complète (aperçu, partage) : 2 mm. */
const PAPER_MARGIN = 16

export interface RenderedLabel {
  layout: LabelLayout
  encoded: EncodedBarcode
  size: LabelBarcodeSize
  /** Nom, variante, prix — largeur = largeur des barres. */
  header: MonoBitmap
  /** Barres seules (sans marges), pour le mode image. */
  bars: MonoBitmap
  /** Numéro, réparti sous les barres. */
  number: MonoBitmap
  /** Étiquette entière à la largeur du papier (aperçu, partage). */
  full: HTMLCanvasElement
}

function font(px: number, bold: boolean): string {
  return `${bold ? '700' : '400'} ${px}px ${FONT_FAMILY}`
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d indisponible') // i18n:allow — erreur technique, jamais affichée
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  return [canvas, ctx]
}

/** Noir et blanc net (seuil, pas de tramage : un texte tramé devient illisible sur papier thermique). */
function toMono(ctx: CanvasRenderingContext2D, width: number, height: number): MonoBitmap {
  const data = ctx.getImageData(0, 0, width, height).data
  const pixels: boolean[][] = []
  for (let y = 0; y < height; y++) {
    const row: boolean[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      row.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] < 150)
    }
    pixels.push(row)
  }
  return { width, height, pixels }
}

function drawMono(ctx: CanvasRenderingContext2D, bitmap: MonoBitmap, x0: number, y0: number) {
  for (let y = 0; y < bitmap.height; y++) {
    const row = bitmap.pixels[y]
    let x = 0
    while (x < bitmap.width) {
      if (!row[x]) {
        x++
        continue
      }
      const start = x
      while (x < bitmap.width && row[x]) x++
      ctx.fillRect(x0 + start, y0 + y, x - start, 1)
    }
  }
}

export function renderLabel(text: Omit<LabelText, 'barcodeText'> & { barcode: string }, paperDots: number, size: LabelBarcodeSize): RenderedLabel {
  const encoded = encodeBarcode(text.barcode)
  const [, measureCtx] = canvasOf(1, 1)
  const measure: MeasureText = (value, px, bold) => {
    measureCtx.font = font(px, bold)
    return measureCtx.measureText(value).width
  }
  const layout = computeLabelLayout({ ...text, barcodeText: encoded.text }, encoded, paperDots, size, measure)
  const { width } = layout
  const { moduleDots, barHeight } = layout.geometry

  // En-tête : chaque ligne centrée sur la largeur des barres.
  const [, headerCtx] = canvasOf(width, layout.header.height)
  headerCtx.textAlign = 'center'
  headerCtx.textBaseline = 'alphabetic'
  for (const line of layout.header.lines) {
    headerCtx.font = font(line.fontPx, line.bold)
    headerCtx.fillText(line.text, width / 2, line.baseline)
  }
  const header = toMono(headerCtx, width, layout.header.height)

  // Barres : exactement moduleDots points par barre fine.
  const row: boolean[] = []
  for (let x = 0; x < width; x++) row.push(encoded.modules[Math.floor(x / moduleDots)] ?? false)
  const bars: MonoBitmap = { width, height: barHeight, pixels: Array.from({ length: barHeight }, () => row) }

  // Numéro : un chiffre au centre de chaque case, d'un bord à l'autre des barres.
  const [, numberCtx] = canvasOf(width, layout.number.height)
  numberCtx.textAlign = 'center'
  numberCtx.font = font(layout.number.fontPx, false)
  ;[...encoded.text].forEach((digit, i) => numberCtx.fillText(digit, layout.number.centers[i], layout.number.baseline))
  const number = toMono(numberCtx, width, layout.number.height)

  // Étiquette entière, à la largeur du papier, centrée comme à l'impression.
  const [full, fullCtx] = canvasOf(paperDots, layout.totalHeight + PAPER_MARGIN * 2)
  const x0 = Math.floor((paperDots - width) / 2)
  let y = PAPER_MARGIN
  drawMono(fullCtx, header, x0, y)
  y += layout.header.height + layout.headerGap
  drawMono(fullCtx, bars, x0, y)
  y += barHeight + layout.numberGap
  drawMono(fullCtx, number, x0, y)

  return { layout, encoded, size, header, bars, number, full }
}
