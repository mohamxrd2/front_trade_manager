import { describe, expect, test } from 'vitest'
import { BarcodeFormat, BitArray, Code128Reader, DecodeHintType, EAN13Reader, MultiFormatOneDReader, type OneDReader } from '@zxing/library'

import { ean13, expandUpcE, gtinCheckDigit, normalizeBarcode, validateBarcode } from './validate'
import { code128Values, encodeBarcode, type EncodedBarcode } from './symbology'
import { barcodeBitmap, encodeLabelEscPosBlocks, labelBarcodeGeometry, nativeBarcodeCommand } from './label-escpos'

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

describe('étiquette ESC/POS', () => {
  const label = { productName: 'Savon', variantName: 'Citron', price: '500 FCFA', barcode: '3017620422003' }
  const flat = (blocks: Uint8Array[]) => Array.from(blocks.flatMap((b) => Array.from(b)))
  const indexOf = (haystack: number[], needle: number[]) =>
    haystack.findIndex((_, i) => needle.every((byte, j) => haystack[i + j] === byte))

  test('EAN-13 : GS k 67 (EAN13) avec les 13 chiffres, numéro sous les barres', () => {
    const command = Array.from(nativeBarcodeCommand(encodeBarcode('3017620422003'), 384, 'cp437'))
    const k = indexOf(command, [0x1d, 0x6b])
    expect(command.slice(k, k + 4)).toEqual([0x1d, 0x6b, 67, 13])
    expect(String.fromCharCode(...command.slice(k + 4, k + 17))).toBe('3017620422003')
    expect(indexOf(command, [0x1d, 0x48, 2])).toBeGreaterThanOrEqual(0)
  })

  test('autre code : GS k 73 (CODE128) en jeu B', () => {
    const command = Array.from(nativeBarcodeCommand(encodeBarcode('SAV-01'), 384, 'cp437'))
    const k = indexOf(command, [0x1d, 0x6b])
    expect(command.slice(k, k + 4)).toEqual([0x1d, 0x6b, 73, 8])
    expect(String.fromCharCode(...command.slice(k + 4, k + 12))).toBe('{BSAV-01')
  })

  test('UPC-A et EAN-8 passent en CODE128 (EAN13 réservé aux EAN-13)', () => {
    for (const code of ['036000291452', '96385074']) {
      const command = Array.from(nativeBarcodeCommand(encodeBarcode(code), 384, 'cp437'))
      expect(command[indexOf(command, [0x1d, 0x6b]) + 2]).toBe(73)
    }
  })

  test('nom, variante et prix dans la table de caractères choisie ; plusieurs exemplaires séparés et coupés', () => {
    const bytes = flat(encodeLabelEscPosBlocks({ ...label, productName: 'Crème' }, { copies: 3, cutPaper: true, charset: 'cp437' }))
    expect(bytes.slice(0, 5)).toEqual([0x1b, 0x40, 0x1b, 0x74, 0])
    expect(indexOf(bytes, [0x43, 0x72, 0x8a, 0x6d, 0x65])).toBeGreaterThan(0) // « Crème » en CP437 (è = 0x8A)
    expect(bytes.filter((_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x6b)).toHaveLength(3)
    expect(bytes.filter((_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x56)).toHaveLength(3)
  })

  test('sans coupe : aucun GS V', () => {
    const bytes = flat(encodeLabelEscPosBlocks(label, { copies: 2 }))
    expect(indexOf(bytes, [0x1d, 0x56])).toBe(-1)
  })

  test('mode image : barres en raster (GS v 0), aucun GS k, numéro écrit en texte', () => {
    const blocks = encodeLabelEscPosBlocks(label, { barcodeMode: 'image', maxBlockBytes: 160 })
    const bytes = flat(blocks)
    expect(indexOf(bytes, [0x1d, 0x6b])).toBe(-1)
    expect(indexOf(bytes, [0x1d, 0x76, 0x30])).toBeGreaterThan(0)
    expect(blocks.every((b) => b.length <= 160)).toBe(true)
    expect(indexOf(bytes, [...'3017620422003'].map((c) => c.charCodeAt(0)))).toBeGreaterThan(0)
  })

  test('image : 3 points par module en 58 mm pour un EAN-13, centrée dans la largeur', () => {
    const bitmap = barcodeBitmap(encodeBarcode('3017620422003'), 384)
    expect(bitmap.width).toBe((95 + 18) * 3)
    expect(bitmap.width).toBeLessThanOrEqual(384)
  })

  test('nombre d’exemplaires borné (1 à 50)', () => {
    const count = (copies: number) => flat(encodeLabelEscPosBlocks(label, { copies })).filter((_, i, a) => a[i] === 0x1d && a[i + 1] === 0x6b).length
    expect(count(0)).toBe(1)
    expect(count(500)).toBe(50)
  })
})

describe('taille du code-barre sur l’étiquette', () => {
  const ean = encodeBarcode('3017620422003')
  const setupOf = (bytes: number[]) => {
    const h = bytes.findIndex((_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x68)
    const w = bytes.findIndex((_, i) => bytes[i] === 0x1d && bytes[i + 1] === 0x77)
    return { height: bytes[h + 2], module: bytes[w + 2] }
  }

  test('commande native : hauteur 6 / 10 / 15 mm, barres plus larges en « grand » si le papier le permet', () => {
    expect(setupOf(Array.from(nativeBarcodeCommand(ean, 384, 'cp437', 'small')))).toEqual({ height: 48, module: 2 })
    expect(setupOf(Array.from(nativeBarcodeCommand(ean, 384, 'cp437', 'medium')))).toEqual({ height: 80, module: 3 })
    // 58 mm : un EAN-13 ne tient pas avec des barres de 4 points → bornées à 3 (le code resterait illisible sinon).
    expect(setupOf(Array.from(nativeBarcodeCommand(ean, 384, 'cp437', 'large')))).toEqual({ height: 120, module: 3 })
    expect(setupOf(Array.from(nativeBarcodeCommand(ean, 576, 'cp437', 'large')))).toEqual({ height: 120, module: 4 })
  })

  test('image : mêmes dimensions que la commande native, jamais plus large que le papier', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const geometry = labelBarcodeGeometry(ean, 384, size)
      const bitmap = barcodeBitmap(ean, 384, size)
      expect([bitmap.width, bitmap.height]).toEqual([geometry.widthDots, geometry.heightDots])
      expect(bitmap.width).toBeLessThanOrEqual(384)
    }
    expect(barcodeBitmap(ean, 384, 'small').width).toBeLessThan(barcodeBitmap(ean, 384, 'medium').width)
  })

  test('la taille choisie est envoyée pour chaque exemplaire ; « moyen » par défaut', () => {
    const label = { productName: 'Savon', price: '500 FCFA', barcode: '3017620422003' }
    const flatten = (blocks: Uint8Array[]) => blocks.flatMap((b) => Array.from(b))
    const heights = (bytes: number[]) => bytes.flatMap((_, i) => (bytes[i] === 0x1d && bytes[i + 1] === 0x68 ? [bytes[i + 2]] : []))
    expect(heights(flatten(encodeLabelEscPosBlocks(label, { copies: 2, barcodeSize: 'large' })))).toEqual([120, 120])
    expect(heights(flatten(encodeLabelEscPosBlocks(label)))).toEqual([80])
  })
})
