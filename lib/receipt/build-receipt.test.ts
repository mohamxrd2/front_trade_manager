import { describe, expect, test } from 'vitest'
import {
  buildReceipt,
  charsPerLineFor,
  type ReceiptCompanyInfo,
  type ReceiptDisplaySettings,
  type ReceiptLabels,
  type ReceiptOperationInput,
  type ReceiptColumnsRow,
  type ReceiptTextRow,
} from './build-receipt'
import { formatMoney } from '@/lib/i18n/format'

// formatMoney('fr-FR') utilise l'espace fine insécable (U+202F) comme
// séparateur de milliers, pas une espace normale — toujours comparer aux
// montants via formatMoney() plutôt qu'en recopiant "24 000" à la main.
const fcfa = (n: number) => formatMoney(n, 'FCFA', 'fr')

const LABELS_FR: ReceiptLabels = {
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

const LABELS_EN: ReceiptLabels = {
  ticketNumber: 'Receipt no.',
  cashier: 'Cashier',
  client: 'Client',
  total: 'TOTAL',
  paidBy: 'Paid by',
  received: 'Received',
  changeGiven: 'Change given',
  duplicate: 'DUPLICATE',
  paymentMethodUnknown: 'Not specified',
  defaultFooter: 'Thank you for your visit!',
  waellyMention: 'Waelly',
}

const COMPANY: ReceiptCompanyInfo = {
  name: 'Boutique Awa',
  logoUrl: null,
  address: 'Cocody, Abidjan',
  phone: '+225 07 00 00 00 00',
  taxId: 'CI-ABJ-2024-B-12345',
}

const SETTINGS_58: ReceiptDisplaySettings = {
  width: '58mm',
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showTaxId: true,
  footerMessage: null,
  showQr: true,
  showWaellyMention: true,
}

const BASE_OPERATION: ReceiptOperationInput = {
  code: 'V-261028-0042',
  date: '2026-10-28T14:32:00Z',
  paymentMethodLabel: 'Wave',
  totalAmount: 24000,
  clientName: null,
  authorName: 'Awa Koné',
  lines: [{ name: 'Robe wax', variationName: 'Taille M', quantity: 2, unitPrice: 12000, amount: 24000 }],
}

function textRows(model: ReturnType<typeof buildReceipt>): ReceiptTextRow[] {
  return model.rows.filter((r): r is ReceiptTextRow => r.kind === 'text')
}

function columnsRows(model: ReturnType<typeof buildReceipt>): ReceiptColumnsRow[] {
  return model.rows.filter((r): r is ReceiptColumnsRow => r.kind === 'columns')
}

describe('charsPerLineFor', () => {
  test('58mm -> 32 caractères, 80mm -> 48 caractères', () => {
    expect(charsPerLineFor('58mm')).toBe(32)
    expect(charsPerLineFor('80mm')).toBe(48)
  })
})

describe('buildReceipt — alignement des colonnes', () => {
  test('en 58mm (32 caractères) : "2 × 12 000" à gauche, "24 000" à droite, ligne de 32 caractères', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const [line] = columnsRows(model)
    expect(line.text).toHaveLength(32)
    expect(line.text.startsWith(`2 × ${fcfa(12000)}`)).toBe(true)
    expect(line.text.trimEnd().endsWith(fcfa(24000))).toBe(true)
  })

  test('en 80mm (48 caractères) : même principe, ligne de 48 caractères', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, { ...SETTINGS_58, width: '80mm' }, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const [line] = columnsRows(model)
    expect(line.text).toHaveLength(48)
    expect(line.text.startsWith(`2 × ${fcfa(12000)}`)).toBe(true)
    expect(line.text.trimEnd().endsWith(fcfa(24000))).toBe(true)
  })

  test('si gauche + droite dépassent la largeur, repli sur une simple jointure (pas de padding négatif)', () => {
    const longOperation: ReceiptOperationInput = {
      ...BASE_OPERATION,
      lines: [{ name: 'Article', quantity: 999, unitPrice: 1234567, amount: 1234567000 }],
    }
    const model = buildReceipt(longOperation, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const [line] = columnsRows(model)
    expect(line.text).toContain(' ')
    expect(() => line.text).not.toThrow()
  })
})

describe('buildReceipt — coupure des noms longs', () => {
  test('un nom d’article + variation trop long est coupé sur plusieurs lignes, jamais un mot en deux', () => {
    const operation: ReceiptOperationInput = {
      ...BASE_OPERATION,
      lines: [
        {
          name: 'Robe wax imprimée motif traditionnel édition limitée',
          variationName: 'Taille XXL Extra Grande',
          quantity: 1,
          unitPrice: 35000,
          amount: 35000,
        },
      ],
    }
    const model = buildReceipt(operation, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const nameLines = textRows(model).filter((r) => r.align === 'left')
    expect(nameLines.length).toBeGreaterThan(1)
    for (const row of nameLines) {
      expect(row.text.length).toBeLessThanOrEqual(32)
    }
    // Recoller les lignes reproduit le texte original mot pour mot (aucun mot coupé).
    expect(nameLines.map((r) => r.text).join(' ')).toBe('Robe wax imprimée motif traditionnel édition limitée · Taille XXL Extra Grande')
  })
})

describe('buildReceipt — totaux', () => {
  test('la ligne TOTAL affiche le libellé et le montant total formaté', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const total = textRows(model).find((r) => r.text.startsWith('TOTAL'))
    expect(total).toBeDefined()
    expect(total?.text).toContain(fcfa(24000))
    expect(total?.bold).toBe(true)
  })
})

describe('buildReceipt — espèces avec monnaie', () => {
  test('espèces avec billet reçu : lignes "Reçu" et "Monnaie rendue" affichées', () => {
    const operation: ReceiptOperationInput = {
      ...BASE_OPERATION,
      paymentMethodLabel: 'Espèces',
      amountReceived: 25000,
      changeGiven: 1000,
    }
    const model = buildReceipt(operation, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const rows = textRows(model)
    expect(rows.some((r) => r.text.includes('Reçu') && r.text.includes(fcfa(25000)))).toBe(true)
    expect(rows.some((r) => r.text.includes('Monnaie rendue') && r.text.includes(fcfa(1000)))).toBe(true)
  })

  test('paiement non-espèces : aucune ligne Reçu/Monnaie rendue', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const rows = textRows(model)
    expect(rows.some((r) => r.text.includes('Reçu'))).toBe(false)
    expect(rows.some((r) => r.text.includes('Monnaie rendue'))).toBe(false)
  })
})

describe('buildReceipt — DUPLICATA', () => {
  test('duplicate: true affiche la mention DUPLICATA juste sous le numéro de ticket', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR, duplicate: true })
    const rows = textRows(model)
    const ticketIndex = rows.findIndex((r) => r.text.startsWith('Ticket n°'))
    expect(rows[ticketIndex + 1]?.text).toBe('DUPLICATA')
  })

  test('sans réimpression (par défaut) : pas de mention DUPLICATA', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text === 'DUPLICATA')).toBe(false)
  })
})

describe('buildReceipt — moyen de paiement non précisé', () => {
  test('ancienne vente sans moyen de paiement connu : "Payé par : Non précisé"', () => {
    const operation: ReceiptOperationInput = { ...BASE_OPERATION, paymentMethodLabel: null }
    const model = buildReceipt(operation, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text === 'Payé par : Non précisé')).toBe(true)
  })
})

describe('buildReceipt — client et caissier optionnels', () => {
  test('aucun client renseigné : pas de ligne Client', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text.startsWith('Client'))).toBe(false)
  })

  test('client renseigné : ligne Client affichée', () => {
    const operation: ReceiptOperationInput = { ...BASE_OPERATION, clientName: 'Fatou Diabaté' }
    const model = buildReceipt(operation, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text === 'Caissier : Awa Koné')).toBe(true)
    expect(textRows(model).some((r) => r.text === 'Client : Fatou Diabaté')).toBe(true)
  })

  test('opération sans auteur distinct (authorName null) : pas de ligne Caissier', () => {
    const operation: ReceiptOperationInput = { ...BASE_OPERATION, authorName: null }
    const model = buildReceipt(operation, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text.startsWith('Caissier'))).toBe(false)
  })
})

describe('buildReceipt — message de bas de page', () => {
  test('message personnalisé : affiché au lieu du message par défaut', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, { ...SETTINGS_58, footerMessage: 'À bientôt chez nous !' }, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text === 'À bientôt chez nous !')).toBe(true)
    expect(textRows(model).some((r) => r.text === 'Merci de votre visite !')).toBe(false)
  })

  test('aucun message réglé : message par défaut', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(textRows(model).some((r) => r.text === 'Merci de votre visite !')).toBe(true)
  })
})

describe('buildReceipt — réglages logo / adresse / téléphone / contribuable / QR / mention Waelly', () => {
  test('tout désactivé : aucune des lignes correspondantes ne sort', () => {
    const settings: ReceiptDisplaySettings = {
      width: '58mm',
      showLogo: false,
      showAddress: false,
      showPhone: false,
      showTaxId: false,
      footerMessage: null,
      showQr: false,
      showWaellyMention: false,
    }
    const model = buildReceipt(BASE_OPERATION, COMPANY, settings, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    expect(model.rows.some((r) => r.kind === 'logo')).toBe(false)
    expect(model.rows.some((r) => r.kind === 'qr')).toBe(false)
    expect(textRows(model).some((r) => r.text === COMPANY.address)).toBe(false)
    expect(textRows(model).some((r) => r.text === COMPANY.phone)).toBe(false)
    expect(textRows(model).some((r) => r.text === COMPANY.taxId)).toBe(false)
    expect(textRows(model).some((r) => r.text === 'Waelly')).toBe(false)
  })

  test('QR actif : une ligne qr avec le code du ticket comme contenu', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const qr = model.rows.find((r) => r.kind === 'qr')
    expect(qr && 'payload' in qr ? qr.payload : null).toBe('V-261028-0042')
  })
})

describe('buildReceipt — ticket en anglais', () => {
  test('les libellés anglais fournis par l’appelant sont utilisés tels quels (buildReceipt ne traduit rien lui-même)', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'en', currency: 'FCFA', labels: LABELS_EN })
    const rows = textRows(model)
    expect(rows.some((r) => r.text.startsWith('Receipt no.'))).toBe(true)
    expect(rows.some((r) => r.text.startsWith('TOTAL'))).toBe(true)
    expect(rows.some((r) => r.text === 'Caissier : Awa Koné')).toBe(false)
    expect(rows.some((r) => r.text === 'Cashier : Awa Koné')).toBe(true)
  })

  test('la date est formatée en anglais (mois en toutes lettres, fuseau Africa/Abidjan)', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'en', currency: 'FCFA', labels: LABELS_EN })
    const rows = textRows(model)
    expect(rows.some((r) => /October 28, 2026/.test(r.text))).toBe(true)
  })

  test('la date est formatée en français (fuseau Africa/Abidjan)', () => {
    const model = buildReceipt(BASE_OPERATION, COMPANY, SETTINGS_58, { language: 'fr', currency: 'FCFA', labels: LABELS_FR })
    const rows = textRows(model)
    expect(rows.some((r) => /28 [Oo]ctobre 2026/.test(r.text))).toBe(true)
  })
})
