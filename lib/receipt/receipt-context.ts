/**
 * Morceaux communs à tous les tickets construits côté écran (après une
 * vente, réimpression, aperçu des Paramètres, ticket de test de la Nouvelle
 * vente) — un seul endroit pour les libellés, les réglages et l'entreprise.
 */

import type { Company } from '@/lib/services/company'
import type { ReceiptSettings } from '@/lib/services/receipt-settings'
import type { ReceiptCompanyInfo, ReceiptDisplaySettings, ReceiptLabels, ReceiptOperationInput } from './build-receipt'

type Translate = (key: string, params?: Record<string, string | number>) => string

export function receiptLabels(t: Translate): ReceiptLabels {
  return {
    ticketNumber: t('wallet.receipt.ticketNumber'),
    cashier: t('wallet.receipt.cashier'),
    client: t('wallet.checkout.clientLabel'),
    total: t('wallet.receipt.total'),
    paidBy: t('wallet.receipt.paidBy'),
    received: t('wallet.receipt.received'),
    changeGiven: t('wallet.checkout.changeLabel'),
    duplicate: t('wallet.receipt.duplicate'),
    paymentMethodUnknown: t('wallet.detail.paymentMethodUnknown'),
    defaultFooter: t('wallet.receipt.defaultFooter'),
    waellyMention: 'Waelly', // i18n:allow — nom de marque, jamais traduit
  }
}

export function receiptDisplaySettings(settings: ReceiptSettings): ReceiptDisplaySettings {
  return {
    width: settings.width,
    showLogo: settings.show_logo,
    showAddress: settings.show_address,
    showPhone: settings.show_phone,
    showTaxId: settings.show_tax_id,
    footerMessage: settings.footer_message,
    showQr: settings.show_qr,
    showWaellyMention: settings.show_waelly_mention,
  }
}

/** Nom de l'entreprise vide : nom du compte, puis la marque en dernier recours. */
export function receiptCompanyInfo(company: Company | null | undefined, accountName: string): ReceiptCompanyInfo {
  return {
    name: company?.name || accountName || 'Waelly', // i18n:allow — nom de secours uniquement si ni l'entreprise ni le compte n'ont de nom
    logoUrl: company?.logo_url ?? null,
    address: company?.headquarters ?? null,
    phone: company?.phone ?? null,
    taxId: company?.tax_id ?? null,
  }
}

/** Un seul exemple, jamais envoyé au serveur : aperçu des Paramètres et ticket de test. */
export function sampleReceiptOperation(t: Translate): ReceiptOperationInput {
  return {
    code: 'V-261028-0042',
    date: '2026-10-28T14:32:00Z',
    paymentMethodLabel: t('wallet.deposit.paymentMethodCash'),
    totalAmount: 24000,
    amountReceived: 25000,
    changeGiven: 1000,
    clientName: null,
    authorName: null,
    lines: [{ name: t('settings.receipt.sampleArticle'), quantity: 2, unitPrice: 12000, amount: 24000 }],
  }
}
