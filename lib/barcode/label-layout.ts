import type { EncodedBarcode } from './symbology'

/**
 * Mise en page d'une étiquette, en POINTS d'imprimante (203 dpi : 8 points
 * = 1 mm). Une seule source pour l'aperçu, l'image partagée et l'impression :
 * ce qui est montré est ce qui sort, au point près.
 *
 * Règle : la largeur des barres est la référence. Le nom, la variante, le
 * prix et le numéro tiennent dedans et sont centrés sur le même axe que les
 * barres ; le numéro est réparti exactement d'un bord à l'autre des barres.
 * Toutes les tailles (texte, barres, espaces) suivent la taille choisie.
 */

export type LabelBarcodeSize = 'small' | 'medium' | 'large'
export const LABEL_BARCODE_SIZES: LabelBarcodeSize[] = ['small', 'medium', 'large']
export const DOTS_PER_MM = 8

export interface LabelSizeSpec {
  /** Hauteur des barres. */
  barHeight: number
  /** Largeur maximale d'une barre fine (bornée par le papier). */
  maxModule: number
  /** Hauteurs de police visées (points) et espaces. */
  nameFont: number
  variantFont: number
  priceFont: number
  numberFont: number
  /** Espace entre les barres et le numéro. */
  numberGap: number
  /** Espace entre deux blocs de texte, et entre le prix et les barres. */
  lineGap: number
  /** Nombre de lignes maximum pour le nom. */
  nameLines: number
}

export const LABEL_SIZE_SPEC: Record<LabelBarcodeSize, LabelSizeSpec> = {
  // 6 mm de barres
  small: { barHeight: 48, maxModule: 2, nameFont: 16, variantFont: 14, priceFont: 24, numberFont: 16, numberGap: 3, lineGap: 3, nameLines: 2 },
  // 10 mm
  medium: { barHeight: 80, maxModule: 3, nameFont: 22, variantFont: 19, priceFont: 34, numberFont: 20, numberGap: 4, lineGap: 4, nameLines: 2 },
  // 15 mm
  large: { barHeight: 120, maxModule: 4, nameFont: 28, variantFont: 24, priceFont: 46, numberFont: 26, numberGap: 6, lineGap: 6, nameLines: 2 },
}

export interface BarGeometry {
  /** Points par barre fine. */
  moduleDots: number
  /** Largeur des barres seules (sans marges blanches) : la référence de l'étiquette. */
  barsWidth: number
  /** Largeur avec les marges blanches obligatoires. */
  widthWithQuiet: number
  barHeight: number
}

export function barGeometry(encoded: EncodedBarcode, paperDots: number, size: LabelBarcodeSize): BarGeometry {
  const spec = LABEL_SIZE_SPEC[size]
  const totalModules = encoded.modules.length + encoded.quietLeft + encoded.quietRight
  const moduleDots = Math.max(1, Math.min(spec.maxModule, Math.floor(paperDots / totalModules)))
  return {
    moduleDots,
    barsWidth: encoded.modules.length * moduleDots,
    widthWithQuiet: Math.min(paperDots, totalModules * moduleDots),
    barHeight: spec.barHeight,
  }
}

/** Mesure la largeur d'un texte (points) pour une police donnée. Injectée : canvas dans le navigateur, approximation dans les tests. */
export type MeasureText = (text: string, fontPx: number, bold: boolean) => number

export interface TextLine {
  text: string
  fontPx: number
  bold: boolean
  /** Ligne de base, depuis le haut de l'en-tête. */
  baseline: number
}

/** Plus grande police ≤ `target` pour que `text` tienne dans `maxWidth` (minimum lisible : 10 points). */
export function fitFont(text: string, target: number, maxWidth: number, bold: boolean, measure: MeasureText): number {
  let font = target
  while (font > 10 && measure(text, font, bold) > maxWidth) font -= 1
  return font
}

/**
 * Coupe `text` en au plus `maxLines` lignes de largeur ≤ `maxWidth` ; si ça
 * ne tient pas, réduit la police ; en dernier recours, termine par « … ».
 */
export function wrapText(text: string, target: number, maxWidth: number, maxLines: number, bold: boolean, measure: MeasureText): { lines: string[]; fontPx: number } {
  const words = text.trim().split(/\s+/).filter(Boolean)
  for (let font = target; font >= 10; font--) {
    const lines: string[] = []
    let current = ''
    let fits = true
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (measure(candidate, font, bold) <= maxWidth) {
        current = candidate
        continue
      }
      if (measure(word, font, bold) > maxWidth) {
        fits = false
        break
      }
      lines.push(current)
      current = word
    }
    if (current) lines.push(current)
    if (fits && lines.length <= maxLines) return { lines, fontPx: font }
  }
  // Toujours trop long à 10 points : on remplit au caractère près (un mot trop long est coupé)
  // et la dernière ligne se termine par « … ». Aucune ligne ne dépasse.
  const font = 10
  const fitsWidth = (value: string) => measure(value, font, bold) <= maxWidth
  const lines: string[] = []
  let current = ''
  for (const char of words.join(' ')) {
    const candidate = current + char
    if (fitsWidth(candidate)) {
      current = candidate
      continue
    }
    lines.push(current.trimEnd())
    current = char === ' ' ? '' : char
  }
  if (current.trim()) lines.push(current.trim())
  const kept = lines.slice(0, maxLines)
  if (lines.length > maxLines || kept.length === 0) {
    let last = kept[kept.length - 1] ?? ''
    while (last && !fitsWidth(`${last}…`)) last = last.slice(0, -1)
    kept[Math.max(0, kept.length - 1)] = `${last.trimEnd()}…`
  }
  return { lines: kept, fontPx: font }
}

export interface LabelLayout {
  geometry: BarGeometry
  /** Largeur commune de l'en-tête, des barres et du numéro. */
  width: number
  header: { height: number; lines: TextLine[] }
  /** Espace entre l'en-tête (prix) et les barres. */
  headerGap: number
  number: {
    height: number
    fontPx: number
    /** Centre de chaque chiffre (points depuis le bord gauche des barres). */
    centers: number[]
    baseline: number
  }
  numberGap: number
  /** Hauteur totale (en-tête + barres + numéro). */
  totalHeight: number
}

export interface LabelText {
  productName: string
  variantName?: string | null
  price: string
  barcodeText: string
}

/** Hauteur d'une ligne de texte : la police plus un peu d'interligne (les jambages ne touchent pas la ligne suivante). */
const lineHeight = (font: number) => Math.ceil(font * 1.2)

export function computeLabelLayout(text: LabelText, encoded: EncodedBarcode, paperDots: number, size: LabelBarcodeSize, measure: MeasureText): LabelLayout {
  const spec = LABEL_SIZE_SPEC[size]
  const geometry = barGeometry(encoded, paperDots, size)
  const width = geometry.barsWidth
  const lines: TextLine[] = []
  let y = 0

  const name = wrapText(text.productName, spec.nameFont, width, spec.nameLines, true, measure)
  for (const line of name.lines) {
    y += lineHeight(name.fontPx)
    lines.push({ text: line, fontPx: name.fontPx, bold: true, baseline: y - Math.round(name.fontPx * 0.22) })
  }
  if (text.variantName) {
    const font = fitFont(text.variantName, spec.variantFont, width, false, measure)
    y += lineHeight(font)
    lines.push({ text: text.variantName, fontPx: font, bold: false, baseline: y - Math.round(font * 0.22) })
  }
  y += spec.lineGap
  const priceFont = fitFont(text.price, spec.priceFont, width, true, measure)
  y += lineHeight(priceFont)
  lines.push({ text: text.price, fontPx: priceFont, bold: true, baseline: y - Math.round(priceFont * 0.22) })

  // Numéro : un chiffre par case, cases égales sur toute la largeur des barres.
  const digits = [...text.barcodeText]
  const cell = width / Math.max(1, digits.length)
  const widest = Math.max(...digits.map((d) => measure(d, 1, false)), 0.01)
  const numberFont = Math.max(8, Math.min(spec.numberFont, Math.floor((cell * 0.92) / widest)))
  const centers = digits.map((_, i) => cell * i + cell / 2)
  const numberHeight = lineHeight(numberFont)

  const headerGap = spec.lineGap
  return {
    geometry,
    width,
    header: { height: y, lines },
    headerGap,
    number: { height: numberHeight, fontPx: numberFont, centers, baseline: numberHeight - Math.round(numberFont * 0.22) },
    numberGap: spec.numberGap,
    totalHeight: y + headerGap + geometry.barHeight + spec.numberGap + numberHeight,
  }
}
