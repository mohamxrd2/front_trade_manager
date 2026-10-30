import { describe, expect, test } from 'vitest'

import { buildReceipt, type ReceiptModel } from './build-receipt'
import { encodeCharsetTestPage, encodeReceiptEscPos, encodeReceiptEscPosBlocks } from './escpos-encoder'
import { allowedTextBytes, encodeTextForCharset, PRINTER_CHARSETS, type PrinterCharset } from './escpos/charsets'
import { packetizeBlocks } from './packetize'

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

function indexOfSequence(bytes: Uint8Array | number[], sequence: number[]): number {
  outer: for (let i = 0; i <= bytes.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (bytes[i + j] !== sequence[j]) continue outer
    }
    return i
  }
  return -1
}
const contains = (bytes: Uint8Array | number[], sequence: number[]) => indexOfSequence(bytes, sequence) !== -1
const ascii = (text: string) => Array.from(text).map((c) => c.charCodeAt(0))

const LABELS = {
  ticketNumber: 'Ticket n°',
  cashier: 'Caissier',
  client: 'Client',
  total: 'TOTAL',
  paidBy: 'Payé par',
  received: 'Reçu',
  changeGiven: 'Monnaie rendue',
  duplicate: 'DUPLICATA',
  paymentMethodUnknown: 'Non précisé',
  defaultFooter: 'Merci de votre visite !',
  waellyMention: 'Waelly',
}

/** Le ticket de la photo : 1 × 130 000 FCFA, payé en espèces, avec QR. */
function realTicket(options: { name?: string; width?: '58mm' | '80mm'; logo?: boolean } = {}): ReceiptModel {
  return buildReceipt(
    {
      code: 'V-261030-0005',
      date: '2026-10-30T10:00:00Z',
      paymentMethodLabel: 'Espèces',
      totalAmount: 130000,
      amountReceived: 130000,
      changeGiven: 0,
      authorName: 'Zoran',
      clientName: 'Aïcha Koné',
      lines: [
        { name: 'Robe brodée', variationName: 'Taille M', quantity: 1, unitPrice: 130000, amount: 130000 },
        { name: 'Écharpe « été »', quantity: 2, unitPrice: 1250000, amount: 2500000 },
      ],
    },
    { name: options.name ?? 'Blanka', logoUrl: options.logo ? 'https://example.test/logo.png' : null, address: 'Cocody, Abidjan' },
    {
      width: options.width ?? '58mm',
      showLogo: !!options.logo,
      showAddress: true,
      showPhone: false,
      showTaxId: false,
      showQr: true,
      showWaellyMention: true,
    },
    { language: 'fr', currency: 'FCFA', labels: LABELS }
  )
}

/** Logo factice : carré noir sur fond blanc. */
function fakeLogo(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const black = x > width / 4 && x < (3 * width) / 4
      data.set(black ? [0, 0, 0, 255] : [255, 255, 255, 255], i)
    }
  }
  return { width, height, data }
}

/** Texte « nu » d'un bloc de ligne : sans ESC a n, ESC E n, GS ! n ni LF. */
function textPayload(block: Uint8Array): number[] | null {
  if (block[0] !== ESC || block[1] !== 0x61) return null
  const out: number[] = []
  for (let i = 3; i < block.length; i++) {
    if (block[i] === ESC && block[i + 1] === 0x45) {
      i += 2
      continue
    }
    if (block[i] === GS && block[i + 1] === 0x21) {
      i += 2
      continue
    }
    if (block[i] === LF) continue
    out.push(block[i])
  }
  return out
}

describe('normalisation du texte avant ESC/POS', () => {
  test('« 130 000 » avec U+202F (fr-FR) ou U+00A0 → espace normal (0x20), plus jamais « ? »', () => {
    for (const text of ['130 000 FCFA', '130 000 FCFA']) {
      const bytes = encodeTextForCharset(text, 'cp437')
      expect(bytes).toEqual(ascii('130 000 FCFA'))
      expect(bytes).not.toContain(0x3f)
    }
  })

  test('« × » → « x » (plus de « ₧ » en CP437)', () => {
    expect(encodeTextForCharset('1 × 130 000', 'cp437')).toEqual(ascii('1 x 130 000'))
  })

  test('autres symboles hors ASCII → équivalent ASCII (·, guillemets, tirets, °, €)', () => {
    expect(encodeTextForCharset('Ticket n° · « été » – 5 €', 'cp437')).toEqual([
      ...ascii('Ticket no - " '),
      0x82,
      ...ascii('t'),
      0x82,
      ...ascii(' " - 5 EUR'),
    ])
  })

  test('le ticket réel : plus aucun « ? » ni « 0x9E » nulle part', () => {
    const bytes = encodeReceiptEscPos(realTicket())
    const text = Array.from(bytes)
    expect(text).not.toContain(0x9e)
    expect(contains(bytes, ascii('1 x 130 000 FCFA'))).toBe(true)
    expect(contains(bytes, ascii('TOTAL 130 000 FCFA'))).toBe(true)
    expect(contains(bytes, [...ascii('Re'), 0x87, ...ascii('u : 130 000 FCFA')])).toBe(true)
  })
})

describe('tables de caractères', () => {
  const ESC_T: Record<PrinterCharset, number> = { cp437: 0, cp850: 2, cp858: 19, ascii: 0 }

  test.each(PRINTER_CHARSETS)('%s : ESC @ puis ESC t n, une seule fois, avant tout texte', (charset) => {
    const bytes = encodeReceiptEscPos(realTicket(), { charset })
    expect(Array.from(bytes.slice(0, 5))).toEqual([ESC, 0x40, ESC, 0x74, ESC_T[charset]])
    // Jamais une seconde commande ESC t au milieu d'une ligne (l'ancien encodeur l'envoyait avant le nom).
    expect(indexOfSequence(bytes.slice(5), [ESC, 0x74])).toBe(-1)
  })

  test.each(['cp437', 'cp850', 'cp858'] as const)('%s : é è à ç → 0x82 0x8A 0x85 0x87', (charset) => {
    expect(encodeTextForCharset('éèàç', charset)).toEqual([0x82, 0x8a, 0x85, 0x87])
  })

  test('CP850/CP858 ont les majuscules accentuées, CP437 retombe sur la lettre sans accent', () => {
    expect(encodeTextForCharset('À', 'cp850')).toEqual([0xb7])
    expect(encodeTextForCharset('À', 'cp858')).toEqual([0xb7])
    expect(encodeTextForCharset('À', 'cp437')).toEqual(ascii('A'))
  })

  test('« Sans accents » : uniquement de l’ASCII, accents retirés', () => {
    expect(encodeTextForCharset('Payé par : Espèces, Reçu', 'ascii')).toEqual(ascii('Paye par : Especes, Recu'))
    const blocks = encodeReceiptEscPosBlocks(realTicket(), { charset: 'ascii' })
    for (const block of blocks) {
      const payload = textPayload(block)
      if (payload) expect(payload.every((b) => b >= 0x20 && b <= 0x7e)).toBe(true)
    }
  })

  test.each(PRINTER_CHARSETS)('%s : aucun octet de texte hors de la table, pour un ticket complet', (charset) => {
    const allowed = allowedTextBytes(charset)
    const blocks = encodeReceiptEscPosBlocks(realTicket({ width: '80mm' }), { charset, printQr: true })
    let textBlocks = 0
    for (const block of blocks) {
      const payload = textPayload(block)
      if (!payload) continue
      textBlocks++
      for (const byte of payload) expect(allowed.has(byte), `octet 0x${byte.toString(16)} (${charset})`).toBe(true)
    }
    expect(textBlocks).toBeGreaterThan(10)
  })
})

describe('nom de l’entreprise en tête', () => {
  test('juste après l’initialisation, centré, gras et double hauteur (GS ! 0x01)', () => {
    const blocks = encodeReceiptEscPosBlocks(realTicket())
    expect(Array.from(blocks[1])).toEqual([ESC, 0x61, 1, ESC, 0x45, 1, GS, 0x21, 0x01, ...ascii('Blanka'), LF, GS, 0x21, 0x00, ESC, 0x45, 0])
  })

  test('toujours imprimé, même avec un logo activé (le logo passe avant, le nom reste)', () => {
    const bytes = encodeReceiptEscPos(realTicket({ logo: true }), { printLogo: true, logoImage: fakeLogo(120, 40) })
    expect(contains(bytes, ascii('Blanka'))).toBe(true)
  })

  test('nom vide : le nom du compte', () => {
    const bytes = encodeReceiptEscPos(realTicket({ name: '  ' }), { companyNameFallback: 'Awa Koné' })
    expect(contains(bytes, [...ascii('Awa Kon'), 0x82])).toBe(true)
  })

  test('modèle sans ligne de nom (ticket de test) : le nom est ajouté en tête', () => {
    const model: ReceiptModel = { width: '58mm', charsPerLine: 32, rows: [{ kind: 'text', text: 'Test', align: 'left' }] }
    const blocks = encodeReceiptEscPosBlocks(model, { companyNameFallback: 'Blanka' })
    expect(contains(blocks[1], ascii('Blanka'))).toBe(true)
  })

  test('« large » = double hauteur seulement : « TOTAL 130 000 FCFA » ne déborde plus sur 58 mm', () => {
    const bytes = encodeReceiptEscPos(realTicket())
    expect(contains(bytes, [GS, 0x21, 0x11])).toBe(false)
    const total = indexOfSequence(bytes, ascii('TOTAL'))
    expect(Array.from(bytes.slice(total - 3, total))).toEqual([GS, 0x21, 0x01])
  })
})

describe('logo et QR code', () => {
  test('désactivés par défaut : aucune commande d’image, et plus jamais de QR natif GS ( k', () => {
    const bytes = encodeReceiptEscPos(realTicket({ logo: true }), { logoImage: fakeLogo(120, 40) })
    expect(contains(bytes, [GS, 0x76, 0x30])).toBe(false)
    expect(contains(bytes, [GS, 0x28, 0x6b])).toBe(false)
  })

  test.each([
    ['58mm', 48],
    ['80mm', 72],
  ] as const)('logo activé (%s) : GS v 0 avec %d octets par ligne, hauteur totale = celle du logo', (width, bytesPerRow) => {
    const blocks = encodeReceiptEscPosBlocks(realTicket({ logo: true, width }), { printLogo: true, logoImage: fakeLogo(200, 50) })
    const raster = blocks.filter((b) => b[0] === GS && b[1] === 0x76 && b[2] === 0x30)
    expect(raster.length).toBeGreaterThan(0)
    let rows = 0
    for (const band of raster) {
      expect(band[3]).toBe(0) // mode normal
      expect(band[4] | (band[5] << 8)).toBe(bytesPerRow)
      const bandRows = band[6] | (band[7] << 8)
      expect(band.length).toBe(8 + bytesPerRow * bandRows)
      rows += bandRows
    }
    expect(rows).toBe(50)
  })

  test('QR activé : imprimé en image raster (GS v 0), pas en GS ( k', () => {
    const bytes = encodeReceiptEscPos(realTicket(), { printQr: true })
    expect(contains(bytes, [GS, 0x76, 0x30])).toBe(true)
    expect(contains(bytes, [GS, 0x28, 0x6b])).toBe(false)
  })
})

describe('découpage en paquets Bluetooth', () => {
  test('aucun bloc (commande ou ligne) n’est plus grand qu’un paquet', () => {
    const blocks = encodeReceiptEscPosBlocks(realTicket({ logo: true, width: '80mm' }), {
      printLogo: true,
      logoImage: fakeLogo(340, 160),
      printQr: true,
      cutPaper: true,
    })
    for (const block of blocks) expect(block.length).toBeLessThanOrEqual(160)
  })

  test('chaque paquet est une suite de blocs ENTIERS : jamais une commande coupée', () => {
    const blocks = encodeReceiptEscPosBlocks(realTicket({ logo: true }), { printLogo: true, logoImage: fakeLogo(230, 100), printQr: true })
    const packets = packetizeBlocks(blocks, 160)

    let blockIndex = 0
    for (const packet of packets) {
      expect(packet.length).toBeLessThanOrEqual(160)
      let offset = 0
      while (offset < packet.length) {
        const block = blocks[blockIndex]
        expect(Array.from(packet.slice(offset, offset + block.length))).toEqual(Array.from(block))
        offset += block.length
        blockIndex++
      }
    }
    expect(blockIndex).toBe(blocks.length)
  })

  test('un bloc plus grand qu’un paquet (cas extrême) est découpé sans perte', () => {
    const big = new Uint8Array(400).map((_, i) => i % 256)
    const packets = packetizeBlocks([Uint8Array.from([1, 2]), big], 160)
    expect(packets.reduce((sum, p) => sum + p.length, 0)).toBe(402)
  })
})

describe('coupe papier', () => {
  test('désactivée par défaut, GS V 0 si activée', () => {
    expect(contains(encodeReceiptEscPos(realTicket()), [GS, 0x56, 0x00])).toBe(false)
    expect(contains(encodeReceiptEscPos(realTicket(), { cutPaper: true }), [GS, 0x56, 0x00])).toBe(true)
  })
})

describe('page de test des caractères', () => {
  test('accents, montant avec séparateur U+202F et « x », dans la table choisie', () => {
    const blocks = encodeCharsetTestPage('58mm', 'cp437', {
      title: 'Test des caractères',
      charsetName: 'CP437',
      accents: 'é è à ç ù ô',
      amount: '130 000 FCFA',
      multiply: '1 × 130 000 FCFA',
    })
    const bytes = blocks.flatMap((b) => Array.from(b))
    expect(bytes.slice(0, 5)).toEqual([ESC, 0x40, ESC, 0x74, 0])
    expect(contains(bytes, [0x82, 0x20, 0x8a, 0x20, 0x85, 0x20, 0x87, 0x20, 0x97, 0x20, 0x93])).toBe(true)
    expect(contains(bytes, ascii('130 000 FCFA'))).toBe(true)
    expect(contains(bytes, ascii('1 x 130 000 FCFA'))).toBe(true)
  })
})
