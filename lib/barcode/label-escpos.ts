import { DEFAULT_PRINTER_CHARSET, ESC_T_CODE, encodeTextForCharset, type PrinterCharset } from '@/lib/receipt/escpos/charsets'
import { DEFAULT_MAX_BLOCK_BYTES, textBlock } from '@/lib/receipt/escpos-encoder'
import { printerDotsFor, rasterCommands, type MonoBitmap } from '@/lib/receipt/escpos/raster'
import { encodeBarcode, type EncodedBarcode } from './symbology'

/**
 * Étiquette produit pour l'imprimante à tickets (58/80 mm) : nom (+ variante),
 * prix, code-barre et son numéro dessous.
 *
 * Code-barre :
 * - « native » : commande GS k de l'imprimante (EAN-13 si c'est un EAN-13,
 *   sinon CODE128) — net, rapide ;
 * - « image » : barres dessinées puis imprimées en raster (GS v 0), pour les
 *   imprimantes qui ignorent GS k (réglage dans les Paramètres).
 * Même encodage du texte que les tickets (table de caractères choisie).
 */

export type LabelBarcodeMode = 'native' | 'image'

export interface LabelContent {
  productName: string
  variantName?: string | null
  /** Prix déjà formaté au format de la boutique (« 2 500 FCFA »). */
  price: string
  barcode: string
}

export interface LabelEncodeOptions {
  width?: '58mm' | '80mm'
  charset?: PrinterCharset
  copies?: number
  cutPaper?: boolean
  barcodeMode?: LabelBarcodeMode
  barcodeSize?: LabelBarcodeSize
  maxBlockBytes?: number
}

export const MAX_LABEL_COPIES = 50

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

/** Taille du code-barre sur l'étiquette (choisie à l'impression). */
export type LabelBarcodeSize = 'small' | 'medium' | 'large'
export const LABEL_BARCODE_SIZES: LabelBarcodeSize[] = ['small', 'medium', 'large']

/**
 * Hauteur des barres (points, 8 points = 1 mm à 203 dpi) et largeur maximale
 * d'une barre fine (points). La largeur réelle reste bornée par le papier :
 * un code plus large que le papier ne se lirait plus.
 */
export const LABEL_BARCODE_SIZE_SPEC: Record<LabelBarcodeSize, { heightDots: number; maxModuleDots: number }> = {
  small: { heightDots: 48, maxModuleDots: 2 }, // 6 mm
  medium: { heightDots: 80, maxModuleDots: 3 }, // 10 mm
  large: { heightDots: 120, maxModuleDots: 4 }, // 15 mm
}

/** Hauteur des barres par défaut (taille « moyenne »). */
export const LABEL_BARCODE_HEIGHT_DOTS = LABEL_BARCODE_SIZE_SPEC.medium.heightDots

/** Dimensions réelles du code imprimé (points) : la même pour GS k, l'image et l'aperçu. */
export function labelBarcodeGeometry(encoded: EncodedBarcode, paperDots: number, size: LabelBarcodeSize = 'medium') {
  const spec = LABEL_BARCODE_SIZE_SPEC[size]
  const totalModules = encoded.modules.length + encoded.quietLeft + encoded.quietRight
  const moduleDots = Math.max(1, Math.min(spec.maxModuleDots, Math.floor(paperDots / totalModules)))
  return { moduleDots, heightDots: spec.heightDots, widthDots: Math.min(paperDots, totalModules * moduleDots), totalModules }
}

/** GS k (format 2 : m n d1…dn) avec ses réglages : HRI dessous, hauteur, largeur de module. */
export function nativeBarcodeCommand(encoded: EncodedBarcode, paperDots: number, charset: PrinterCharset, size: LabelBarcodeSize = 'medium'): Uint8Array {
  // Largeur de module (GS w accepte 2 à 6 partout ; 1 sur beaucoup) et hauteur selon la taille choisie.
  const { moduleDots, heightDots } = labelBarcodeGeometry(encoded, paperDots, size)
  const setup = [
    ESC, 0x61, 1, // centré
    GS, 0x48, 2, // numéro (HRI) sous les barres
    GS, 0x66, 0, // police A pour le numéro
    GS, 0x68, heightDots,
    GS, 0x77, moduleDots,
  ]
  let data: number[]
  let m: number
  if (encoded.symbology === 'ean13' && encoded.text.length === 13) {
    m = 67 // EAN13
    data = [...encoded.text].map((c) => c.charCodeAt(0))
  } else {
    m = 73 // CODE128, jeu B annoncé par « {B »
    data = [0x7b, 0x42, ...encodeTextForCharset(encoded.text, charset)]
  }
  return Uint8Array.from([...setup, GS, 0x6b, m, data.length, ...data, LF])
}

/** Barres → image 1 bit, `moduleDots` points par module, marges blanches comprises. */
export function barcodeBitmap(encoded: EncodedBarcode, paperDots: number, size: LabelBarcodeSize = 'medium'): MonoBitmap {
  const { moduleDots, heightDots, widthDots: width } = labelBarcodeGeometry(encoded, paperDots, size)
  const row: boolean[] = []
  for (let x = 0; x < width; x++) {
    const index = Math.floor(x / moduleDots) - encoded.quietLeft
    row.push(index >= 0 && index < encoded.modules.length && encoded.modules[index])
  }
  return { width, height: heightDots, pixels: Array.from({ length: heightDots }, () => row) }
}

/** Blocs ESC/POS de `copies` étiquettes à la suite (un petit espace, et une coupe si l'imprimante en a une). */
export function encodeLabelEscPosBlocks(label: LabelContent, options: LabelEncodeOptions = {}): Uint8Array[] {
  const {
    width = '58mm',
    charset = DEFAULT_PRINTER_CHARSET,
    copies = 1,
    cutPaper = false,
    barcodeMode = 'native',
    barcodeSize = 'medium',
    maxBlockBytes = DEFAULT_MAX_BLOCK_BYTES,
  } = options
  const paperDots = printerDotsFor(width)
  const encoded = encodeBarcode(label.barcode)
  const count = Math.max(1, Math.min(MAX_LABEL_COPIES, Math.floor(copies)))

  const blocks: Uint8Array[] = [Uint8Array.from([ESC, 0x40, ESC, 0x74, ESC_T_CODE[charset]])]
  for (let copy = 0; copy < count; copy++) {
    blocks.push(textBlock(label.productName, charset, { align: 'center', bold: true }))
    if (label.variantName) blocks.push(textBlock(label.variantName, charset, { align: 'center' }))
    blocks.push(textBlock(label.price, charset, { align: 'center', bold: true, doubleHeight: true }))
    if (barcodeMode === 'native') {
      blocks.push(nativeBarcodeCommand(encoded, paperDots, charset, barcodeSize))
    } else {
      blocks.push(...rasterCommands(barcodeBitmap(encoded, paperDots, barcodeSize), paperDots, maxBlockBytes))
      blocks.push(textBlock(encoded.text, charset, { align: 'center' }))
    }
    const last = copy === count - 1
    blocks.push(Uint8Array.from(last ? [LF, LF, LF] : [LF, LF]))
    if (cutPaper) blocks.push(Uint8Array.from([GS, 0x56, 0x00]))
  }
  return blocks
}
