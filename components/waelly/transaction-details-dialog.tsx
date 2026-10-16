'use client'

import * as React from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import type { Transaction } from '@/lib/services/transactions'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'

dayjs.locale('fr')

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

interface DetailRow {
  label: string
  value: React.ReactNode
}

interface TransactionDetailsDialogProps {
  transaction: Transaction | null
  onOpenChange: (open: boolean) => void
  /** Numéro de facture déjà résolu (ex. wallet/page.tsx a sa propre invoiceMap) — sinon un simple lien générique. */
  invoiceNumber?: string
}

/**
 * Popup « toutes les informations sur la transaction » — ouvert au clic
 * d'une ligne, sur Dernières opérations (Tableau de bord) et Portefeuille,
 * mobile comme ordinateur (la Dialog Radix centrée est déjà responsive des
 * deux côtés, pas besoin d'un Drawer séparé pour mobile).
 */
function TransactionDetailsDialog({ transaction, onOpenChange, invoiceNumber }: TransactionDetailsDialogProps) {
  const open = transaction !== null
  if (!transaction) return null

  const isSale = transaction.type === 'sale'
  const title = (isSale && transaction.article_name) || transaction.name
  const unitPrice = transaction.sale_price ?? transaction.unit_price ?? null

  const rows: DetailRow[] = []
  if (isSale && transaction.quantity) rows.push({ label: 'Quantité', value: transaction.quantity })
  if (isSale && unitPrice != null) rows.push({ label: 'Prix unitaire', value: `${formatAmount(unitPrice)} F` })
  if (isSale && transaction.variation_name) rows.push({ label: 'Variante', value: transaction.variation_name })
  if (isSale && transaction.article_name && transaction.article_name !== transaction.name) {
    rows.push({ label: 'Nom de la vente', value: transaction.name })
  }
  rows.push({ label: 'Date', value: dayjs(transaction.date).format('D MMMM YYYY à HH:mm') })
  rows.push({
    label: 'Facture',
    value: transaction.invoice_id ? (
      <Link href={`/invoices/${transaction.invoice_id}`} className="font-semibold text-brand-700">
        {invoiceNumber || 'Voir la facture'}
      </Link>
    ) : (
      <span className="text-ink-3">—</span>
    ),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-[rgba(14,14,26,0.42)] backdrop-blur-[4px]" />
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-2.5rem)] max-w-[440px] rounded-[26px] border-none bg-surface p-6 shadow-[0_40px_90px_rgba(10,10,60,0.35)]"
        >
          <div className="flex items-start gap-3.5">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                isSale ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
              }`}
            >
              {isSale ? <ArrowUpRight className="size-5" strokeWidth={2.2} /> : <ArrowDownLeft className="size-5" strokeWidth={2.2} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DialogTitle className="truncate text-lg font-bold text-ink">{title}</DialogTitle>
              <span className="text-sm text-subtle">{isSale ? 'Vente' : 'Dépense'}</span>
            </span>
          </div>

          <span
            className={`text-[32px] font-bold tracking-[-0.02em] ${isSale ? 'text-success' : 'text-danger'}`}
          >
            {isSale ? '+' : '−'}
            {formatAmount(transaction.amount ?? 0)} F
          </span>

          <div className="flex flex-col divide-y divide-divider rounded-tile border border-line">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-subtle">{row.label}</span>
                <span className="text-right text-sm font-semibold text-ink">{row.value}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex min-h-11 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink"
          >
            Fermer
          </button>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

export { TransactionDetailsDialog }
export type { TransactionDetailsDialogProps }
