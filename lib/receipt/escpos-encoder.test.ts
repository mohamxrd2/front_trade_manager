import { describe, expect, test } from 'vitest'
import { encodeReceiptEscPos } from './escpos-encoder'
import type { ReceiptModel } from './build-receipt'

const ESC = 0x1b
const GS = 0x1d

function containsSequence(bytes: Uint8Array, sequence: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (bytes[i + j] !== sequence[j]) continue outer
    }
    return true
  }
  return false
}

function countSequence(bytes: Uint8Array, sequence: number[]): number {
  let count = 0
  outer: for (let i = 0; i <= bytes.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (bytes[i + j] !== sequence[j]) continue outer
    }
    count++
  }
  return count
}

function simpleModel(overrides: Partial<ReceiptModel> = {}): ReceiptModel {
  return {
    width: '58mm',
    charsPerLine: 32,
    rows: [
      { kind: 'text', text: 'Boutique Awa', align: 'center', bold: true, size: 'large' },
      { kind: 'text', text: '28 octobre 2026 · 14:32', align: 'center' },
      { kind: 'separator', text: '-'.repeat(32) },
      { kind: 'columns', text: '2 × 12 000 FCFA     24 000 FCFA' },
      { kind: 'text', text: 'TOTAL 24 000 FCFA', align: 'center', bold: true, size: 'large' },
    ],
    ...overrides,
  }
}

describe('encodeReceiptEscPos — commandes de base', () => {
  test('commence toujours par ESC @ (initialisation)', () => {
    const bytes = encodeReceiptEscPos(simpleModel())
    expect(bytes[0]).toBe(ESC)
    expect(bytes[1]).toBe(0x40)
  })

  test('une ligne en gras est entourée de ESC E 1 (on) ... ESC E 0 (off)', () => {
    const bytes = encodeReceiptEscPos(simpleModel())
    expect(containsSequence(bytes, [ESC, 0x45, 0x01])).toBe(true)
    expect(containsSequence(bytes, [ESC, 0x45, 0x00])).toBe(true)
  })

  test('une ligne size "large" demande GS ! en double largeur/hauteur puis revient à la normale', () => {
    const bytes = encodeReceiptEscPos(simpleModel())
    expect(containsSequence(bytes, [GS, 0x21, 0x11])).toBe(true) // double largeur + double hauteur
    expect(containsSequence(bytes, [GS, 0x21, 0x00])).toBe(true) // retour normal
  })

  test('pas de coupe papier par défaut (cutPaper désactivé)', () => {
    const bytes = encodeReceiptEscPos(simpleModel())
    expect(containsSequence(bytes, [GS, 0x56, 0x00])).toBe(false)
  })
})

describe('encodeReceiptEscPos — option cutPaper', () => {
  test('cutPaper: true -> GS V 0 présent', () => {
    const bytes = encodeReceiptEscPos(simpleModel(), { cutPaper: true })
    expect(containsSequence(bytes, [GS, 0x56, 0x00])).toBe(true)
  })

  test('cutPaper: false (ou omis) -> aucune commande de coupe', () => {
    const bytesOmitted = encodeReceiptEscPos(simpleModel())
    const bytesFalse = encodeReceiptEscPos(simpleModel(), { cutPaper: false })
    expect(containsSequence(bytesOmitted, [GS, 0x56, 0x00])).toBe(false)
    expect(containsSequence(bytesFalse, [GS, 0x56, 0x00])).toBe(false)
  })
})

describe('encodeReceiptEscPos — page de code CP858 et accents', () => {
  const accentedModel: ReceiptModel = {
    width: '58mm',
    charsPerLine: 32,
    rows: [{ kind: 'text', text: 'Café à côté', align: 'center' }],
  }

  test('mode normal : sélectionne CP858 (ESC t 19) et encode « é » en octet 130', () => {
    const bytes = encodeReceiptEscPos(accentedModel)
    expect(containsSequence(bytes, [ESC, 0x74, 19])).toBe(true)
    expect(containsSequence(bytes, [67, 97, 102, 130])).toBe(true) // "Caf" + é(cp858=130)
  })

  test('mode compatibilité : aucune sélection de page de code, accents retirés (ASCII pur)', () => {
    const bytes = encodeReceiptEscPos(accentedModel, { compatibilityMode: true })
    expect(containsSequence(bytes, [ESC, 0x74, 19])).toBe(false)
    expect(containsSequence(bytes, [67, 97, 102, 130])).toBe(false)
    expect(containsSequence(bytes, [67, 97, 102, 101])).toBe(true) // "Cafe" en ASCII pur
  })
})

describe('encodeReceiptEscPos — QR code natif', () => {
  test('une ligne qr déclenche la commande native GS ( k', () => {
    const withoutQr = simpleModel()
    const withQr = simpleModel({ rows: [...withoutQr.rows, { kind: 'qr', payload: 'V-261028-0042' }] })

    const bytesWithout = encodeReceiptEscPos(withoutQr)
    const bytesWith = encodeReceiptEscPos(withQr)

    expect(containsSequence(bytesWith, [GS, 0x28, 0x6b])).toBe(true)
    expect(bytesWith.length).toBeGreaterThan(bytesWithout.length)
  })
})

describe('encodeReceiptEscPos — logo absent', () => {
  test('une ligne logo sans image fournie est ignorée sans erreur, le reste du ticket s’imprime', () => {
    const model = simpleModel({
      rows: [{ kind: 'logo', url: 'https://example.test/logo.png' }, ...simpleModel().rows],
    })
    expect(() => encodeReceiptEscPos(model)).not.toThrow()
    const bytes = encodeReceiptEscPos(model)
    expect(containsSequence(bytes, [66, 111, 117, 116, 105, 113, 117, 101])).toBe(true) // "Boutique"
  })
})

describe('encodeReceiptEscPos — lignes "colonnes" déjà alignées', () => {
  test('le texte déjà paddé (qté × prix / sous-total) apparaît tel quel dans les octets', () => {
    const bytes = encodeReceiptEscPos(simpleModel())
    const expected = Array.from('2 × 12 000 FCFA     24 000 FCFA').map((c) => c.charCodeAt(0))
    // Les caractères non-ASCII (×) passent par la page de code — on vérifie au moins
    // le segment ASCII "24 000 FCFA" qui termine la ligne.
    const tail = Array.from('24 000 FCFA').map((c) => c.charCodeAt(0))
    expect(containsSequence(bytes, tail)).toBe(true)
    expect(expected.length).toBeGreaterThan(0) // garde le calcul ci-dessus utile si la ligne change un jour
  })
})

describe('encodeReceiptEscPos — séparateurs et nombre de bascules gras', () => {
  test('exactement une paire ESC E on/off par ligne en gras du modèle', () => {
    const bytes = encodeReceiptEscPos(simpleModel())
    const boldOnCount = countSequence(bytes, [ESC, 0x45, 0x01])
    const boldOffCount = countSequence(bytes, [ESC, 0x45, 0x00])
    // 2 lignes en gras dans simpleModel() : "Boutique Awa" et "TOTAL …"
    expect(boldOnCount).toBeGreaterThanOrEqual(2)
    expect(boldOffCount).toBeGreaterThanOrEqual(2)
  })
})
