'use client'

import type { Invoice, InvoiceTheme } from '@/lib/services/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber, formatDate } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Reprend les couleurs réelles utilisées par le backend pour générer le PDF
// de chaque thème (voir components/invoices/invoice-form/step-theme.tsx) —
// pas des couleurs inventées pour l'écran.
const THEME_HEADER: Record<InvoiceTheme, { bg: string; text: string; sub: string }> = {
  modern: { bg: 'bg-[#1d4ed8]', text: 'text-white', sub: 'text-[#bfdbfe]' },
  classic: { bg: 'bg-[#1a1a1a]', text: 'text-white', sub: 'text-white/70' },
  professional: { bg: 'bg-[#1c2431]', text: 'text-white', sub: 'text-[#c9a96e]' },
  minimal: { bg: 'bg-[#fcfcfc]', text: 'text-ink', sub: 'text-ink-3' },
}
const DEFAULT_HEADER = {
  bg: 'bg-[radial-gradient(120%_160%_at_100%_100%,#3A3AF0_0%,#1717A0_40%,#0A0A4A_85%)]',
  text: 'text-white',
  sub: 'text-navy-text',
}

interface InvoicePreviewCardProps {
  invoice: Invoice
}

/**
 * Carte facture — design/maquettes/ordinateur/Web-Factures.dc.html § Aperçu.
 * Utilisée à la fois dans le panneau "Aperçu" (ordinateur) et en pleine page
 * sur /invoices/[id] (mobile et accès direct), pour afficher la même carte.
 */
export function InvoicePreviewCard({ invoice }: InvoicePreviewCardProps) {
  const { t, language } = useTranslation()
  const header = THEME_HEADER[invoice.theme] ?? DEFAULT_HEADER
  const subtotal = Number(invoice.subtotal)
  const discount = Number(invoice.discount_amount)
  const tax = Number(invoice.tax_amount)
  const shipping = Number(invoice.shipping_fee)
  const total = Number(invoice.total)

  return (
    <div className="overflow-hidden rounded-[20px] bg-surface shadow-card">
      <div className={`flex items-start justify-between gap-2.5 px-5 py-4.5 ${header.bg} ${header.text}`}>
        <span className="flex flex-col gap-0.5">
          <span className="text-lg font-extrabold">{invoice.company?.name}</span>
          {invoice.company?.headquarters ? (
            <span className={`text-xs ${header.sub}`}>{invoice.company.headquarters}</span>
          ) : null}
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className={`text-xs ${header.sub}`}>{t('invoices.card.facture')}</span>
          <span className="text-base font-bold">{invoice.invoice_number}</span>
        </span>
      </div>

      <div className="flex flex-col gap-3.5 px-5 py-4.5 text-[13px]">
        <div className="flex items-start justify-between gap-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="text-subtle">{t('invoices.card.billedToLabel')}</span>
            <span className="text-sm font-bold text-ink">{invoice.client?.name}</span>
          </span>
          <span className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-subtle">{t('invoices.date')}</span>
            <span className="font-semibold text-ink">{formatDate(invoice.issued_at, language, 'D MMM YYYY')}</span>
          </span>
        </div>

        <div className="flex flex-col border-t border-divider">
          {invoice.items?.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2.5 border-b border-divider py-2.5">
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold text-ink">{item.name_snapshot}</span>
                <span className="text-xs text-subtle">
                  {item.quantity} × {formatAmount(Number(item.unit_price), language)}
                </span>
              </span>
              <span className="shrink-0 font-bold text-ink">{formatAmount(Number(item.total_line), language)} F</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-ink-3">
            <span>{t('invoices.subtotal')}</span>
            <span>{formatAmount(subtotal, language)} F</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-success">
              <span>{t('invoices.card.discountLabel', { percent: invoice.discount_percent })}</span>
              <span>−{formatAmount(discount, language)} F</span>
            </div>
          ) : null}
          {tax > 0 ? (
            <div className="flex justify-between text-ink-3">
              <span>{t('invoices.card.taxLabel', { percent: invoice.tax_percent })}</span>
              <span>+{formatAmount(tax, language)} F</span>
            </div>
          ) : null}
          {shipping > 0 ? (
            <div className="flex justify-between text-ink-3">
              <span>{t('invoices.card.shippingLabel')}</span>
              <span>+{formatAmount(shipping, language)} F</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-baseline justify-between border-t border-divider pt-3">
          <span className="text-sm font-bold text-ink">{t('invoices.total')}</span>
          <span className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{formatAmount(total, language)} F</span>
        </div>
      </div>
    </div>
  )
}
