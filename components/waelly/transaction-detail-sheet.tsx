'use client'

import * as React from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { ArrowDownLeft, ArrowUpRight, X } from 'lucide-react'

import type { Transaction } from '@/lib/services/transactions'
import type { InvoiceLookupEntry } from '@/lib/hooks/useInvoiceLookup'
import { isDeletableFromList } from '@/lib/transactions/can-delete'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'

dayjs.locale('fr')

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

interface DetailRow {
  label: string
  value: React.ReactNode
}

interface TransactionDetailSheetProps {
  transaction: Transaction | null
  onOpenChange: (open: boolean) => void
  invoiceEntry?: InvoiceLookupEntry
  onRequestDelete: (transaction: Transaction) => void
}

/**
 * Bottom sheet "Détail de la transaction" (mobile) — maquettes Collaborateurs
 * (même composant Drawer que le formulaire ajout/édition). Sert aussi de
 * base pour afficher plus tard le code de transaction et le ticket (voir
 * commentaire dans le spec produit).
 */
function TransactionDetailSheet({ transaction, onOpenChange, invoiceEntry, onRequestDelete }: TransactionDetailSheetProps) {
  const open = transaction !== null
  if (!transaction) return null

  const isSale = transaction.type === 'sale'
  const title = (isSale && transaction.article_name) || transaction.name
  const unitPrice = transaction.sale_price ?? transaction.unit_price ?? null
  const canDelete = isDeletableFromList(transaction, invoiceEntry?.status)

  const rows: DetailRow[] = [{ label: 'Type', value: isSale ? 'Vente' : 'Dépense' }]
  rows.push({ label: 'Date et heure', value: dayjs(transaction.date).format('D MMMM YYYY à HH:mm') })
  if (isSale) {
    rows.push({ label: 'Article', value: transaction.article_name || transaction.name })
    if (transaction.variation_name) rows.push({ label: 'Variation', value: transaction.variation_name })
    if (transaction.quantity) rows.push({ label: 'Quantité', value: transaction.quantity })
    if (unitPrice != null) rows.push({ label: 'Prix unitaire', value: `${formatAmount(unitPrice)} F` })
  }
  rows.push({
    label: transaction.invoice_id ? 'Facture' : 'Client ou facture',
    value: transaction.invoice_id ? (
      <Link href={`/invoices/${transaction.invoice_id}`} className="font-semibold text-brand-700">
        {invoiceEntry?.invoice_number || 'Voir la facture'}
      </Link>
    ) : (
      <span className="text-ink-3">—</span>
    ),
  })
  if (invoiceEntry?.client_name) {
    rows.push({ label: 'Client', value: invoiceEntry.client_name })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-5 pb-8 pt-2.5">
        <DrawerHeader className="mt-1.5">
          <DrawerTitle>Détail de la transaction</DrawerTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fermer"
            className="flex size-10 items-center justify-center rounded-full bg-canvas text-ink"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </DrawerHeader>

        <div className="mt-3.5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                isSale ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
              }`}
            >
              {isSale ? <ArrowUpRight className="size-5" strokeWidth={2.2} /> : <ArrowDownLeft className="size-5" strokeWidth={2.2} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-base font-bold text-ink">{title}</span>
              <span
                className={`text-xl font-bold tracking-[-0.02em] ${isSale ? 'text-success' : 'text-danger'}`}
              >
                {isSale ? '+' : '−'}
                {formatAmount(transaction.amount ?? 0)} F
              </span>
            </span>
          </div>

          <div className="flex flex-col divide-y divide-divider rounded-tile border border-line">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-subtle">{row.label}</span>
                <span className="text-right text-sm font-semibold text-ink">{row.value}</span>
              </div>
            ))}
          </div>

          {canDelete ? (
            <button
              type="button"
              onClick={() => onRequestDelete(transaction)}
              className="flex min-h-11 items-center justify-center rounded-full border text-sm font-bold"
              style={{ color: '#A3213A', borderColor: '#F3C7CF' }}
            >
              Supprimer la transaction
            </button>
          ) : (
            <Link
              href={`/invoices/${transaction.invoice_id}`}
              className="flex min-h-11 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink"
            >
              Voir la facture
            </Link>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export { TransactionDetailSheet }
export type { TransactionDetailSheetProps }
