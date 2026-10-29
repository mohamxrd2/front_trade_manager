'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { Copy } from 'lucide-react'

import type { Transaction } from '@/lib/services/transactions'
import { getOperation } from '@/lib/services/operations'
import type { InvoiceLookupEntry } from '@/lib/hooks/useInvoiceLookup'
import { isDeletableFromList } from '@/lib/transactions/can-delete'
import { getTransactionVisual, fundingSourceLabelKey, paymentMethodLabelKey } from '@/lib/transactions/transaction-visual'
import { usePermissions } from '@/hooks/usePermissions'
import { authorLabel } from '@/lib/permissions/author-label'
import { keys } from '@/lib/query-keys'
import { getCollaborators } from '@/lib/services/collaborators'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { Amount } from './amount'
import { ReceiptActions } from './receipt-actions'

interface DetailRow {
  label: string
  value: React.ReactNode
}

interface TransactionDetailsDialogProps {
  transaction: Transaction | null
  onOpenChange: (open: boolean) => void
  /** Numéro de facture déjà résolu (ex. wallet/page.tsx a sa propre invoiceMap) — sinon un simple lien générique. */
  invoiceNumber?: string
  /** Statut + client de la facture liée — décide Supprimer vs Voir la facture. Omis : le bouton Supprimer reste proposé (le 422 serveur reste le filet de sécurité). */
  invoiceEntry?: InvoiceLookupEntry
  /** Omis : pas de bouton de suppression (comportement précédent, ex. appels qui n'ont pas encore besoin de ce bouton). */
  onRequestDelete?: (transaction: Transaction) => void
}

/**
 * Popup « toutes les informations sur la transaction » — ouvert au clic
 * d'une ligne, sur Dernières opérations (Tableau de bord) et Portefeuille,
 * mobile comme ordinateur (la Dialog Radix centrée est déjà responsive des
 * deux côtés, pas besoin d'un Drawer séparé pour mobile).
 */
function TransactionDetailsDialog({ transaction, onOpenChange, invoiceNumber, invoiceEntry, onRequestDelete }: TransactionDetailsDialogProps) {
  const { t, language } = useTranslation()
  const { can } = usePermissions()
  const open = transaction !== null

  const { data: collaborators = [] } = useQuery({
    queryKey: keys.collaborators.all,
    queryFn: getCollaborators,
    enabled: transaction?.funding_source === 'collaborateur',
  })

  const { data: operation } = useQuery({
    queryKey: keys.operations.detail(transaction?.operation_id ?? ''),
    queryFn: () => getOperation(transaction!.operation_id!),
    enabled: transaction !== null && !!transaction?.operation_id,
  })

  if (!transaction) return null

  const isSale = transaction.type === 'sale'
  const visual = getTransactionVisual(transaction.type)
  const Icon = visual.Icon
  const hasMultipleLines = (operation?.lines.length ?? 0) > 1
  const title = hasMultipleLines
    ? t('wallet.list.articlesCount', { count: operation!.lines.length })
    : (isSale && transaction.article_name) || transaction.name
  const unitPrice = transaction.sale_price ?? transaction.unit_price ?? null
  const canDelete = isDeletableFromList(transaction, invoiceEntry?.status)
  const totalAmount = operation?.totalAmount ?? transaction.amount ?? 0

  const copyCode = async () => {
    if (!operation?.code) return
    try {
      await navigator.clipboard.writeText(operation.code)
    } catch {
      // Best-effort — certains navigateurs/contextes non sécurisés refusent l'accès au presse-papiers.
    }
  }

  const rows: DetailRow[] = []
  if (isSale && !hasMultipleLines && transaction.quantity) rows.push({ label: t('transactions.quantity'), value: transaction.quantity })
  if (isSale && !hasMultipleLines && unitPrice != null)
    rows.push({
      label: t('transactions.unitPrice'),
      value: (
        <>
          <Amount value={unitPrice} /> F
        </>
      ),
    })
  if (isSale && !hasMultipleLines && transaction.variation_name) rows.push({ label: t('transactions.detail.variant'), value: transaction.variation_name })
  if (isSale && !hasMultipleLines && transaction.article_name && transaction.article_name !== transaction.name) {
    rows.push({ label: t('transactions.detail.saleName'), value: transaction.name })
  }
  if (isSale) {
    const methodKey = paymentMethodLabelKey(operation?.paymentMethod ?? transaction.payment_method)
    rows.push({ label: t('wallet.deposit.paymentMethodLabel'), value: methodKey ? t(methodKey) : t('wallet.detail.paymentMethodUnknown') })
    if (operation?.clientName) rows.push({ label: t('transactions.detail.client'), value: operation.clientName })
    if (operation?.paymentMethod === 'especes' && operation.amountReceived != null) {
      rows.push({
        label: t('wallet.checkout.amountReceivedLabel'),
        value: (
          <>
            <Amount value={operation.amountReceived} /> F
          </>
        ),
      })
      rows.push({
        label: t('wallet.checkout.changeLabel'),
        value: (
          <>
            <Amount value={operation.changeGiven ?? 0} /> F
          </>
        ),
      })
    }
  }
  rows.push({
    label: t('transactions.date'),
    value: formatDate(transaction.date, language, language === 'en' ? 'MMMM D, YYYY [at] h:mm A' : 'D MMMM YYYY à HH:mm'),
  })
  if (can('sales.view_all')) {
    const author = authorLabel(operation?.createdBy ?? transaction.createdBy, t)
    if (author) rows.push({ label: t('transactions.sellerFilterLabel'), value: author })
  }
  if (visual.kind === 'apport' || visual.kind === 'retrait') {
    const fundingKey = fundingSourceLabelKey(transaction.funding_source)
    if (fundingKey) rows.push({ label: t('wallet.deposit.fundingSourceLabel'), value: t(fundingKey) })
    if (transaction.funding_source === 'collaborateur') {
      const collaboratorName = collaborators.find((c) => c.id === transaction.collaborator_id)?.name
      rows.push({ label: t('wallet.deposit.collaboratorLabel'), value: collaboratorName || '—' })
    }
    const methodKey = paymentMethodLabelKey(transaction.payment_method)
    if (methodKey) rows.push({ label: t('wallet.deposit.paymentMethodLabel'), value: t(methodKey) })
    if (transaction.note) rows.push({ label: t('wallet.deposit.noteLabel'), value: transaction.note })
  }
  if (isSale || visual.kind === 'expense') {
    rows.push({
      label: t('transactions.detail.invoice'),
      value: transaction.invoice_id ? (
        <Link href={`/invoices/${transaction.invoice_id}`} className="font-semibold text-brand-700">
          {invoiceNumber || invoiceEntry?.invoice_number || t('transactions.detail.viewInvoice')}
        </Link>
      ) : (
        <span className="text-ink-3">{t('transactions.detail.notLinkedToInvoice')}</span>
      ),
    })
  }
  if (invoiceEntry?.client_name) {
    rows.push({ label: t('transactions.detail.client'), value: invoiceEntry.client_name })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-[rgba(14,14,26,0.42)] backdrop-blur-[4px]" />
        <DialogContent
          showCloseButton={false}
          className="max-h-[85vh] w-[calc(100%-2.5rem)] max-w-[440px] overflow-y-auto rounded-[26px] border-none bg-surface p-6 shadow-[0_40px_90px_rgba(10,10,60,0.35)]"
        >
          <div className="flex items-start gap-3.5">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${visual.iconClassName}`}>
              <Icon className="size-5" strokeWidth={2.2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DialogTitle className="truncate text-lg font-bold text-ink">{title}</DialogTitle>
              <span className="text-sm text-subtle">{t(visual.labelKey)}</span>
            </span>
          </div>

          <span className={`text-[32px] font-bold tracking-[-0.02em] ${visual.amountClassName}`}>
            {visual.sign}
            <Amount value={totalAmount} /> F
          </span>

          {operation?.code ? (
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center justify-between gap-2 rounded-tile bg-surface-soft px-4 py-2.5"
            >
              <span className="font-mono text-sm font-bold text-ink">{operation.code}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-600">
                <Copy className="size-3.5" />
                {t('wallet.confirmation.copyCode')}
              </span>
            </button>
          ) : null}

          {hasMultipleLines ? (
            <div className="flex flex-col divide-y divide-divider rounded-tile border border-line">
              {operation!.lines.map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-ink-2">
                    {line.articleName || line.name}
                    {line.variationName ? ` · ${line.variationName}` : ''}
                    {line.quantity && line.quantity > 1 ? ` ×${line.quantity}` : ''}
                  </span>
                  <span className="font-semibold text-ink">
                    <Amount value={line.amount} /> F
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col divide-y divide-divider rounded-tile border border-line">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-subtle">{row.label}</span>
                <span className="text-right text-sm font-semibold text-ink">{row.value}</span>
              </div>
            ))}
          </div>

          {isSale && operation ? <ReceiptActions operation={operation} duplicate /> : null}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink"
            >
              {t('common.close')}
            </button>
            {onRequestDelete ? (
              canDelete ? (
                <button
                  type="button"
                  onClick={() => onRequestDelete(transaction)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-full border text-sm font-bold"
                  style={{ color: '#A3213A', borderColor: '#F3C7CF' }}
                >
                  {t('common.delete')}
                </button>
              ) : (
                <Link
                  href={`/invoices/${transaction.invoice_id}`}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink"
                >
                  {t('transactions.detail.viewInvoice')}
                </Link>
              )
            ) : null}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

export { TransactionDetailsDialog }
export type { TransactionDetailsDialogProps }
