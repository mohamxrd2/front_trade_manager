import { DEFAULT_PRINTER_CHARSET, ESC_T_CODE, type PrinterCharset } from '@/lib/receipt/escpos/charsets'
import { DEFAULT_MAX_BLOCK_BYTES } from '@/lib/receipt/escpos-encoder'
import { printerDotsFor, rasterCommands, type MonoBitmap } from '@/lib/receipt/escpos/raster'
import type { EncodedBarcode } from './symbology'

export { LABEL_BARCODE_SIZES, LABEL_SIZE_SPEC, type LabelBarcodeSize } from './label-layout'

/**
 * Étiquette produit pour l'imprimante à tickets (58/80 mm).
 *
 * Tout est imprimé aux dimensions de la mise en page (lib/barcode/label-layout.ts),
 * au point près : nom, variante, prix et numéro en IMAGE (les polices de
 * l'imprimante ont une taille fixe, impossible à faire correspondre à la
 * taille choisie), les espaces en avance papier exacte (ESC J n).
 * Barres :
 * - « native » : commande GS k (EAN13 si c'est un EAN-13, sinon CODE128),
 *   sans numéro imprimé par l'imprimante (il est dessiné juste dessous) ;
 * - « image » : barres en raster (GS v 0), pour les imprimantes qui ignorent GS k.
 * Barres, texte et numéro ont la même largeur et sont centrés sur le même axe.
 */

export type LabelBarcodeMode = 'native' | 'image'

/** Images et dimensions d'une étiquette, produites par renderLabel(). */
export interface LabelBitmaps {
  encoded: EncodedBarcode
  header: MonoBitmap
  bars: MonoBitmap
  number: MonoBitmap
  moduleDots: number
  barHeight: number
  /** Espace (points) entre le prix et les barres, puis entre les barres et le numéro. */
  headerGap: number
  numberGap: number
}

export interface LabelEncodeOptions {
  width?: '58mm' | '80mm'
  charset?: PrinterCharset
  copies?: number
  cutPaper?: boolean
  barcodeMode?: LabelBarcodeMode
  maxBlockBytes?: number
}

export const MAX_LABEL_COPIES = 50
/** Espace entre deux étiquettes : 4 mm. */
export const LABEL_SPACING_DOTS = 32

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/** Avance du papier de `dots` points exactement (ESC J n, n ≤ 255). */
export function feedDots(dots: number): Uint8Array[] {
  const blocks: Uint8Array[] = []
  for (let left = Math.round(dots); left > 0; left -= 255) blocks.push(Uint8Array.from([ESC, 0x4a, Math.min(255, left)]))
  return blocks
}

/** GS k (format 2 : m n d1…dn) : barres seules, hauteur et largeur de barre fine imposées, centrées, sans numéro. */
export function nativeBarcodeCommand(encoded: EncodedBarcode, moduleDots: number, barHeight: number): Uint8Array {
  const setup = [
    ESC, 0x61, 1, // centré (même axe que les images, centrées sur le papier)
    GS, 0x48, 0, // pas de numéro imprimé par l'imprimante : il est dessiné dessous, à la bonne taille
    GS, 0x68, barHeight,
    GS, 0x77, moduleDots,
  ]
  let data: number[]
  let m: number
  if (encoded.symbology === 'ean13' && encoded.text.length === 13) {
    m = 67 // EAN13
    data = [...encoded.text].map((c) => c.charCodeAt(0))
  } else {
    m = 73 // CODE128, jeu B annoncé par « {B »
    data = [0x7b, 0x42, ...[...encoded.text].map((c) => c.charCodeAt(0))]
  }
  return Uint8Array.from([...setup, GS, 0x6b, m, data.length, ...data, ESC, 0x61, 0])
}

/** Blocs ESC/POS de `copies` étiquettes à la suite (4 mm entre deux, et une coupe si l'imprimante en a une). */
export function encodeLabelEscPosBlocks(label: LabelBitmaps, options: LabelEncodeOptions = {}): Uint8Array[] {
  const {
    width = '58mm',
    charset = DEFAULT_PRINTER_CHARSET,
    copies = 1,
    cutPaper = false,
    barcodeMode = 'native',
    maxBlockBytes = DEFAULT_MAX_BLOCK_BYTES,
  } = options
  const paperDots = printerDotsFor(width)
  const count = Math.max(1, Math.min(MAX_LABEL_COPIES, Math.floor(copies)))

  const blocks: Uint8Array[] = [Uint8Array.from([ESC, 0x40, ESC, 0x74, ESC_T_CODE[charset]])]
  for (let copy = 0; copy < count; copy++) {
    blocks.push(...rasterCommands(label.header, paperDots, maxBlockBytes))
    blocks.push(...feedDots(label.headerGap))
    if (barcodeMode === 'native') {
      blocks.push(nativeBarcodeCommand(label.encoded, label.moduleDots, label.barHeight))
    } else {
      blocks.push(...rasterCommands(label.bars, paperDots, maxBlockBytes))
    }
    blocks.push(...feedDots(label.numberGap))
    blocks.push(...rasterCommands(label.number, paperDots, maxBlockBytes))
    const last = copy === count - 1
    if (last) blocks.push(Uint8Array.from([LF, LF, LF]))
    else blocks.push(...feedDots(LABEL_SPACING_DOTS))
    if (cutPaper) blocks.push(Uint8Array.from([GS, 0x56, 0x00]))
  }
  return blocks
}

/** Les images d'une étiquette rendue (renderLabel) au format attendu par l'encodeur. */
export function labelBitmapsOf(rendered: {
  encoded: EncodedBarcode
  header: MonoBitmap
  bars: MonoBitmap
  number: MonoBitmap
  layout: { geometry: { moduleDots: number; barHeight: number }; headerGap: number; numberGap: number }
}): LabelBitmaps {
  return {
    encoded: rendered.encoded,
    header: rendered.header,
    bars: rendered.bars,
    number: rendered.number,
    moduleDots: rendered.layout.geometry.moduleDots,
    barHeight: rendered.layout.geometry.barHeight,
    headerGap: rendered.layout.headerGap,
    numberGap: rendered.layout.numberGap,
  }
}
