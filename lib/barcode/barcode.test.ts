import { describe, expect, test } from 'vitest'
import { BarcodeFormat, BitArray, Code128Reader, DecodeHintType, EAN13Reader, MultiFormatOneDReader, type OneDReader } from '@zxing/library'

import { ean13, expandUpcE, gtinCheckDigit, normalizeBarcode, validateBarcode } from './validate'
import { code128Values, encodeBarcode, type EncodedBarcode } from './symbology'
import { encodeLabelEscPosBlocks, feedDots, nativeBarcodeCommand, type LabelBitmaps } from './label-escpos'
import { barGeometry, computeLabelLayout, LABEL_SIZE_SPEC, wrapText, type LabelBarcodeSize, type MeasureText } from './label-layout'

describe('validation des codes (mêmes règles que le serveur)', () => {
  test.each([
    ['3017620422003', 'ean13'],
    ['2000000000015', 'ean13'],
    ['96385074', 'ean8'],
    ['036000291452', 'upca'],
    ['04252614', 'upce'],
    ['SAV-01/B.2', 'code128'],
    ['1234567890', 'code128'],
  ])('%s → %s', (code, format) => {
    expect(validateBarcode(code)).toEqual({ ok: true, format })
  })

  test.each([
    ['3017620422004', 'check_digit'],
    ['96385075', 'check_digit'],
    ['036000291453', 'check_digit'],
    ['', 'empty'],
    ['AB1', 'format'],
    ['SAV_01', 'format'],
    ['A'.repeat(33), 'format'],
  ])('%s refusé (%s)', (code, error) => {
    expect(validateBarcode(code)).toEqual({ ok: false, error })
  })

  test('espaces retirés partout, clés EAN calculées', () => {
    expect(normalizeBarcode(' 3 017620 422003\t')).toBe('3017620422003')
    expect(validateBarcode(' 3 017620 422003 ')).toEqual({ ok: true, format: 'ean13' })
    expect(gtinCheckDigit('301762042200')).toBe(3)
    expect(ean13('200000000001')).toBe('2000000000015')
    expect(expandUpcE('04252614')).toBe('042100005264')
  })
})

/** Relit nos barres avec le décodeur de ZXing (celui du scanner) : le dessin est bon s'il redonne le texte. */
function decode(encoded: EncodedBarcode, reader: Pick<OneDReader, 'decodeRow'>): string {
  const modules = [...Array(encoded.quietLeft).fill(false), ...encoded.modules, ...Array(encoded.quietRight).fill(false)]
  const row = new BitArray(modules.length)
  modules.forEach((black, i) => black && row.set(i))
  return reader.decodeRow(0, row, new Map()).getText()
}

describe('dessin des codes-barres', () => {
  test('EAN-13 : 95 modules, relu tel quel', () => {
    const encoded = encodeBarcode('3017620422003')
    expect(encoded.symbology).toBe('ean13')
    expect(encoded.modules).toHaveLength(95)
    expect(decode(encoded, new EAN13Reader())).toBe('3017620422003')
    expect(decode(encodeBarcode('2000000000015'), new EAN13Reader())).toBe('2000000000015')
  })

  test('EAN-8 : 67 modules, relu tel quel', () => {
    const encoded = encodeBarcode('96385074')
    expect(encoded.modules).toHaveLength(67)
    const ean8Only = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_8]]])
    expect(decode(encoded, new MultiFormatOneDReader(ean8Only))).toBe('96385074')
  })

  test('UPC-A : dessiné en EAN-13 commençant par 0, numéro affiché sur 12 chiffres', () => {
    const encoded = encodeBarcode('036000291452')
    expect(encoded.text).toBe('036000291452')
    expect(decode(encoded, new EAN13Reader())).toBe('0036000291452')
  })

  test.each(['SAV-01/B.2', '1234567890', '04252614', 'abc.def', '123'])('Code 128 « %s » relu tel quel', (text) => {
    const encoded = encodeBarcode(text)
    expect(encoded.symbology).toBe('code128')
    expect(decode(encoded, new Code128Reader())).toBe(text)
  })

  test('Code 128 : jeu C pour un nombre pair de chiffres (plus court), clé de contrôle', () => {
    expect(code128Values('1234')).toEqual([105, 12, 34, (105 + 12 * 1 + 34 * 2) % 103, 106])
    expect(code128Values('AB')[0]).toBe(104)
  })
})

// Mesure approchée d'une police sans empattement : 0,58 em (0,62 em en gras).
const measure: MeasureText = (text, px, bold) => text.length * px * (bold ? 0.62 : 0.58)
const SIZES: LabelBarcodeSize[] = ['small', 'medium', 'large']

describe('mise en page de l’étiquette : tout respecte la taille choisie', () => {
  const ean = encodeBarcode('3017620422003')
  const text = { productName: 'Savon de Marseille extra doux', variantName: 'Citron', price: '2 500 FCFA', barcodeText: ean.text }

  test('barres : 6 / 10 / 15 mm de haut ; jamais plus larges que le papier', () => {
    expect(SIZES.map((size) => barGeometry(ean, 384, size).barHeight)).toEqual([48, 80, 120])
    for (const size of SIZES) for (const paper of [384, 576]) expect(barGeometry(ean, paper, size).widthWithQuiet).toBeLessThanOrEqual(paper)
    expect(barGeometry(ean, 384, 'small').barsWidth).toBeLessThan(barGeometry(ean, 384, 'medium').barsWidth)
  })

  test.each(SIZES)('« %s » : nom, variante et prix tiennent dans la largeur des barres', (size) => {
    const layout = computeLabelLayout(text, ean, 384, size, measure)
    for (const line of layout.header.lines) expect(measure(line.text, line.fontPx, line.bold)).toBeLessThanOrEqual(layout.width)
    expect(layout.width).toBe(layout.geometry.barsWidth)
  })

  test.each(SIZES)('« %s » : numéro réparti exactement d’un bord à l’autre des barres, sous les barres', (size) => {
    const layout = computeLabelLayout(text, ean, 384, size, measure)
    const cell = layout.width / 13
    expect(layout.number.centers[0]).toBeCloseTo(cell / 2)
    expect(layout.number.centers[12]).toBeCloseTo(layout.width - cell / 2)
    // Chaque chiffre tient dans sa case : rien ne dépasse à gauche ni à droite.
    expect(measure('0', layout.number.fontPx, false)).toBeLessThanOrEqual(cell)
    expect(layout.numberGap).toBe(LABEL_SIZE_SPEC[size].numberGap)
  })

  test('le texte grandit avec la taille choisie', () => {
    const [small, medium, large] = SIZES.map((size) => computeLabelLayout(text, ean, 576, size, measure))
    const price = (l: typeof small) => l.header.lines[l.header.lines.length - 1].fontPx
    expect(price(small)).toBeLessThan(price(medium))
    expect(price(medium)).toBeLessThan(price(large))
    expect(small.number.fontPx).toBeLessThanOrEqual(medium.number.fontPx)
    expect(small.totalHeight).toBeLessThan(medium.totalHeight)
    expect(medium.totalHeight).toBeLessThan(large.totalHeight)
  })

  test('nom trop long : au plus 2 lignes, police réduite, « … » en dernier recours', () => {
    const wrapped = wrapText('Savon de Marseille extra doux au citron', 22, 120, 2, true, measure)
    expect(wrapped.lines.length).toBeLessThanOrEqual(2)
    for (const line of wrapped.lines) expect(measure(line, wrapped.fontPx, true)).toBeLessThanOrEqual(120)
    const cut = wrapText('Supercalifragilisticexpialidocious '.repeat(4), 22, 60, 2, true, measure)
    expect(cut.lines.at(-1)?.endsWith('…')).toBe(true)
    for (const line of cut.lines) expect(measure(line, cut.fontPx, true)).toBeLessThanOrEqual(60)
  })
})

describe('étiquette ESC/POS : l’imprimante reçoit exactement la mise en page', () => {
  const ean = encodeBarcode('3017620422003')
  const flat = (blocks: Uint8Array[]) => Array.from(blocks.flatMap((b) => Array.from(b)))
  const indexOf = (haystack: number[], needle: number[]) => haystack.findIndex((_, i) => needle.every((byte, j) => haystack[i + j] === byte))
  const count = (bytes: number[], needle: number[]) => bytes.filter((_, i) => needle.every((byte, j) => bytes[i + j] === byte)).length
  const blank = (width: number, height: number) => ({ width, height, pixels: Array.from({ length: height }, () => Array(width).fill(false)) })
  const bitmaps = (size: LabelBarcodeSize): LabelBitmaps => {
    const g = barGeometry(ean, 384, size)
    const spec = LABEL_SIZE_SPEC[size]
    return { encoded: ean, header: blank(g.barsWidth, 40), bars: blank(g.barsWidth, g.barHeight), number: blank(g.barsWidth, 20), moduleDots: g.moduleDots, barHeight: g.barHeight, headerGap: spec.lineGap, numberGap: spec.numberGap }
  }

  test('barres natives : EAN13, hauteur et largeur imposées, centrées, SANS numéro de l’imprimante', () => {
    const command = Array.from(nativeBarcodeCommand(ean, 2, 48))
    expect(indexOf(command, [0x1b, 0x61, 1])).toBe(0)
    expect(indexOf(command, [0x1d, 0x48, 0])).toBeGreaterThan(0) // HRI désactivé : le numéro est dessiné à la bonne taille
    expect(indexOf(command, [0x1d, 0x68, 48])).toBeGreaterThan(0)
    expect(indexOf(command, [0x1d, 0x77, 2])).toBeGreaterThan(0)
    const k = indexOf(command, [0x1d, 0x6b])
    expect(command.slice(k, k + 4)).toEqual([0x1d, 0x6b, 67, 13])
    expect(String.fromCharCode(...command.slice(k + 4, k + 17))).toBe('3017620422003')
  })

  test('autre code : CODE128 en jeu B', () => {
    const command = Array.from(nativeBarcodeCommand(encodeBarcode('SAV-01'), 2, 80))
    const k = indexOf(command, [0x1d, 0x6b])
    expect(command.slice(k, k + 4)).toEqual([0x1d, 0x6b, 73, 8])
    expect(String.fromCharCode(...command.slice(k + 4, k + 12))).toBe('{BSAV-01')
  })

  test.each(SIZES)('« %s » : hauteur des barres et espaces envoyés au point près (ESC J)', (size) => {
    const label = bitmaps(size)
    const bytes = flat(encodeLabelEscPosBlocks(label))
    expect(indexOf(bytes, [0x1d, 0x68, LABEL_SIZE_SPEC[size].barHeight])).toBeGreaterThan(0)
    expect(indexOf(bytes, [0x1d, 0x77, label.moduleDots])).toBeGreaterThan(0)
    expect(indexOf(bytes, [0x1b, 0x4a, label.headerGap])).toBeGreaterThan(0)
    expect(indexOf(bytes, [0x1b, 0x4a, label.numberGap])).toBeGreaterThan(0)
  })

  test('texte et numéro en image (GS v 0), à la même largeur que les barres', () => {
    const label = bitmaps('small')
    expect([label.header.width, label.number.width]).toEqual([label.bars.width, label.bars.width])
    const bytes = flat(encodeLabelEscPosBlocks(label))
    expect(count(bytes, [0x1d, 0x76, 0x30])).toBeGreaterThanOrEqual(2)
  })

  test('mode image : barres en raster, aucun GS k ; blocs jamais trop grands', () => {
    const blocks = encodeLabelEscPosBlocks(bitmaps('medium'), { barcodeMode: 'image', maxBlockBytes: 160 })
    const bytes = flat(blocks)
    expect(indexOf(bytes, [0x1d, 0x6b])).toBe(-1)
    expect(blocks.every((b) => b.length <= 160)).toBe(true)
  })

  test('plusieurs exemplaires : 4 mm entre deux, une coupe chacun si demandé ; 1 à 50', () => {
    const bytes = flat(encodeLabelEscPosBlocks(bitmaps('medium'), { copies: 3, cutPaper: true }))
    expect(count(bytes, [0x1d, 0x6b])).toBe(3)
    expect(count(bytes, [0x1d, 0x56])).toBe(3)
    expect(count(bytes, [0x1b, 0x4a, 32])).toBe(2)
    expect(indexOf(flat(encodeLabelEscPosBlocks(bitmaps('medium'), { copies: 2 })), [0x1d, 0x56])).toBe(-1)
    expect(count(flat(encodeLabelEscPosBlocks(bitmaps('medium'), { copies: 0 })), [0x1d, 0x6b])).toBe(1)
    expect(count(flat(encodeLabelEscPosBlocks(bitmaps('medium'), { copies: 500 })), [0x1d, 0x6b])).toBe(50)
  })

  test('avance papier exacte, même au-delà de 255 points', () => {
    expect(feedDots(300).map((b) => Array.from(b))).toEqual([[0x1b, 0x4a, 255], [0x1b, 0x4a, 45]])
    expect(feedDots(0)).toEqual([])
  })
})
