'use client'

import * as React from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Check, Download } from 'lucide-react'

import { deleteTransaction, type Transaction } from '@/lib/services/transactions'
import { useTransactionsQuery } from '@/lib/hooks/useTransactions'
import { useInvoiceLookup } from '@/lib/hooks/useInvoiceLookup'
import { useDeleteTransactionFlow } from '@/lib/hooks/useDeleteTransactionFlow'
import { isDeletableFromList } from '@/lib/transactions/can-delete'
import { invalidateArticles, invalidateUserStats } from '@/lib/hooks/useCache'
import { keys } from '@/lib/query-keys'
import { useQueryClient } from '@tanstack/react-query'
import { exportToExcel } from '@/lib/utils/export'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber, formatDate } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Button,
  Card,
  FilterChips,
  Pagination,
  StatusBadge,
  TransactionDetailsDialog,
  DeleteTransactionDialog,
  SwipeableTransactionRow,
  TransactionDetailSheet,
} from '@/components/waelly'

const PAGE_SIZE = 10

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

type TypeFilter = 'all' | 'sale' | 'expense'
type Period = 'all' | 'current' | 'previous' | '30d' | 'custom'

function buildTypeChips(t: ReturnType<typeof useTranslation>['t']) {
  return [
    { value: 'all', label: t('wallet.list.typeAll') },
    { value: 'sale', label: t('wallet.list.typeSales') },
    { value: 'expense', label: t('wallet.list.typeExpenses') },
  ]
}

function getPeriodRange(period: Period, customStart: string, customEnd: string) {
  const now = dayjs()
  if (period === 'all') {
    return { start: dayjs(0), end: now.endOf('day') }
  }
  if (period === 'previous') {
    const prev = now.subtract(1, 'month')
    return { start: prev.startOf('month'), end: prev.endOf('month') }
  }
  if (period === '30d') {
    return { start: now.subtract(30, 'day').startOf('day'), end: now.endOf('day') }
  }
  if (period === 'custom' && customStart && customEnd) {
    return { start: dayjs(customStart).startOf('day'), end: dayjs(customEnd).endOf('day') }
  }
  return { start: now.startOf('month'), end: now.endOf('month') }
}

function dayLabel(dateStr: string, language: AppLanguage, t: ReturnType<typeof useTranslation>['t']): string {
  const d = dayjs(dateStr)
  const today = dayjs()
  if (d.isSame(today, 'day')) return t('wallet.today')
  if (d.isSame(today.subtract(1, 'day'), 'day')) return t('wallet.yesterday')
  return formatDate(dateStr, language, 'D MMMM')
}

function transactionTitle(t: Transaction): string {
  if (t.type === 'expense') return t.name
  const parts = [t.article_name || t.name]
  if (t.variation_name) parts.push(t.variation_name)
  let title = parts.join(' · ')
  if (t.quantity && t.quantity > 1) title += ` ×${t.quantity}`
  return title
}

/**
 * Portefeuille — reprend design/maquettes/ordinateur/Web-Portefeuille.dc.html
 * (≥ 1024px) et design/maquettes/mobile/Portefeuille.dc.html (< 768px).
 * Remplace wallet-stats.tsx / transaction-list.tsx / transaction-card.tsx /
 * wallet-actions.tsx / edit-transaction-dialog.tsx (orphelins après ce
 * remplacement — components/wallet/transaction-card.tsx est conservé car
 * app/(dashboard)/dashboard/page.tsx importe son type `Transaction`).
 *
 * Note de fidélité : le composant commun `TransactionRow` colore les ventes
 * en violet (bg-brand-100), pas en vert — ça ne correspond pas à la règle de
 * couleur explicitement demandée ici (vert = entrée, rouge = sortie), donc
 * les lignes sont construites à la main plutôt que via ce composant partagé,
 * pour ne pas changer son rendu sur le tableau de bord qui l'utilise déjà.
 *
 * Écarts assumés :
 * - Suppression en masse : toujours pas d'endpoint dédié, DELETE
 *   /api/transactions/{id} est appelé une fois par opération sélectionnée
 *   (en parallèle). La suppression d'UNE transaction (glissement mobile,
 *   bottom sheet, dialog ordinateur) passe par useDeleteTransactionFlow —
 *   soft delete + restauration via le toast "Annuler" (voir ce hook).
 * - Le numéro de facture n'est pas inclus dans GET /api/transactions : il
 *   est résolu via useInvoiceLookup() (GET /api/invoices, déjà utilisé
 *   ailleurs), croisé sur invoice_id — partagé avec le détail de
 *   transaction (sheet mobile / dialog ordinateur) pour décider Supprimer
 *   vs Voir la facture (facture payée).
 */
export default function WalletPage() {
  const queryClient = useQueryClient()
  const { t, language } = useTranslation()
  const typeChips = React.useMemo(() => buildTypeChips(t), [t])
  const { data: transactions = [], isLoading: loadingTx, error: txErrorObj, refetch: refetchTransactions } = useTransactionsQuery()
  const txError = txErrorObj ? (txErrorObj as Error).message || t('wallet.list.loadError') : null
  const invoiceLookup = useInvoiceLookup()
  const { requestDelete } = useDeleteTransactionFlow()

  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all')
  const [period, setPeriod] = React.useState<Period>('all')
  const [customStart, setCustomStart] = React.useState('')
  const [customEnd, setCustomEnd] = React.useState('')

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [mobileSelecting, setMobileSelecting] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [mobileVisibleCount, setMobileVisibleCount] = React.useState(PAGE_SIZE)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  // États séparés mobile/ordinateur : TransactionDetailSheet (Drawer) et
  // TransactionDetailsDialog (Dialog) sont deux overlays portal-rendues —
  // un seul état partagé les ouvrirait TOUTES LES DEUX en même temps dès
  // qu'une ligne est sélectionnée, quel que soit l'écran actuellement visible.
  const [mobileDetailTransaction, setMobileDetailTransaction] = React.useState<Transaction | null>(null)
  const [desktopDetailTransaction, setDesktopDetailTransaction] = React.useState<Transaction | null>(null)
  // Confirmation de suppression d'UNE transaction — partagée par les deux
  // écrans et les trois points d'entrée (glissement, sheet, dialog).
  const [singleDeleteTarget, setSingleDeleteTarget] = React.useState<Transaction | null>(null)
  // Ligne en cours de sortie (fondu + repli de hauteur) avant l'appel réel à
  // useDeleteTransactionFlow — voir handleConfirmSingleDelete.
  const [exitingRowId, setExitingRowId] = React.useState<string | null>(null)

  const fetchTransactions = React.useCallback(() => refetchTransactions(), [refetchTransactions])

  const handleConfirmSingleDelete = (transaction: Transaction) => {
    setSingleDeleteTarget(null)
    setExitingRowId(transaction.id)
    // Laisse l'animation de sortie (300ms, voir SwipeableTransactionRow) se
    // jouer avant d'envoyer la suppression réelle — négligeable pour
    // l'utilisateur, et garde toute la logique de suppression (optimiste +
    // retour en arrière + toast Annuler) au même endroit pour mobile ET
    // ordinateur (useDeleteTransactionFlow).
    setTimeout(() => {
      requestDelete(transaction)
      setExitingRowId(null)
    }, 300)
  }

  React.useEffect(() => {
    setPage(1)
    setMobileVisibleCount(PAGE_SIZE)
  }, [typeFilter, period, customStart, customEnd])

  const { start, end } = getPeriodRange(period, customStart, customEnd)

  const inPeriod = React.useMemo(
    () => transactions.filter((t) => { const d = dayjs(t.date); return !d.isBefore(start) && !d.isAfter(end) }),
    [transactions, start, end]
  )

  const summary = React.useMemo(() => {
    const entries = inPeriod.filter((t) => t.type === 'sale').reduce((s, t) => s + (t.amount ?? 0), 0)
    const exits = inPeriod.filter((t) => t.type === 'expense').reduce((s, t) => s + (t.amount ?? 0), 0)
    return { entries, exits, balance: entries - exits }
  }, [inPeriod])

  const filteredRows = React.useMemo(
    () => inPeriod.filter((t) => typeFilter === 'all' || t.type === typeFilter),
    [inPeriod, typeFilter]
  )

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const visibleMobileRows = filteredRows.slice(0, mobileVisibleCount)

  const groupedMobileRows = React.useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = []
    visibleMobileRows.forEach((tx) => {
      const label = dayLabel(tx.date, language, t)
      const last = groups[groups.length - 1]
      if (last && last.label === label) {
        last.items.push(tx)
      } else {
        groups.push({ label, items: [tx] })
      }
    })
    return groups
  }, [visibleMobileRows, language, t])

  const periodLabel =
    period === 'all'
      ? t('wallet.list.periodAll')
      : period === 'current'
        ? formatDate(dayjs().toISOString(), language, 'MMMM YYYY')
        : period === 'previous'
          ? formatDate(dayjs().subtract(1, 'month').toISOString(), language, 'MMMM YYYY')
          : period === '30d'
            ? t('wallet.list.periodLast30Days')
            : t('wallet.list.periodCustom')

  const periodShort =
    period === 'all'
      ? t('wallet.list.periodAll')
      : period === 'current'
        ? formatDate(dayjs().toISOString(), language, 'MMM')
        : period === 'previous'
          ? formatDate(dayjs().subtract(1, 'month').toISOString(), language, 'MMM')
          : period === '30d'
            ? t('wallet.list.periodShort30d')
            : t('wallet.list.periodShortCustom')

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Une vente liée à une facture PAYÉE ne peut pas être supprimée (422 serveur,
  // voir TransactionController::destroy()) — la case à cocher est grisée pour
  // ces lignes afin d'éviter l'erreur plutôt que de la laisser se produire
  // puis l'afficher après coup.
  const canSelectForDeletion = (t: Transaction) =>
    isDeletableFromList(t, t.invoice_id ? invoiceLookup[t.invoice_id]?.status : undefined)

  const selectablePaginatedRows = paginatedRows.filter(canSelectForDeletion)
  const allOnPageSelected =
    selectablePaginatedRows.length > 0 && selectablePaginatedRows.every((t) => selectedIds.has(t.id))
  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) selectablePaginatedRows.forEach((t) => next.delete(t.id))
      else selectablePaginatedRows.forEach((t) => next.add(t.id))
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectedTransactions = transactions.filter((t) => selectedIds.has(t.id))
  const selectionHasSale = selectedTransactions.some((t) => t.type === 'sale')
  const selectionHasInvoice = selectedTransactions.some((t) => !!t.invoice_id)

  const confirmDescription = (() => {
    const notes: string[] = []
    if (selectionHasSale) notes.push(t('wallet.list.deleteConfirmNoteStock'))
    if (selectionHasInvoice) notes.push(t('wallet.list.deleteConfirmNoteInvoices'))
    return notes.length
      ? t('wallet.list.deleteConfirmDefinitive', { notes: notes.join(', ') })
      : t('wallet.list.deleteConfirmDefinitiveGeneric')
  })()

  const handleDeleteSelected = async () => {
    setDeleting(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.allSettled(ids.map((id) => deleteTransaction(id)))
    const failedCount = results.filter((r) => r.status === 'rejected').length
    const okCount = ids.length - failedCount

    if (okCount > 0) toast.success(t('wallet.list.deletedCount', { count: okCount }))
    if (failedCount > 0) toast.error(t('wallet.list.deleteFailedCount', { count: failedCount }))

    setSelectedIds(new Set())
    setMobileSelecting(false)
    setDeleteDialogOpen(false)
    setDeleting(false)
    await fetchTransactions()
    await Promise.all([
      invalidateArticles(),
      invalidateUserStats(),
      queryClient.invalidateQueries({ queryKey: keys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: keys.collaborators.all }),
      queryClient.invalidateQueries({ queryKey: keys.analytics.all }),
      queryClient.invalidateQueries({ queryKey: keys.dashboard.all }),
    ])
  }

  const handleExport = () => {
    if (filteredRows.length === 0) {
      toast.error(t('wallet.list.noExportData'))
      return
    }
    const exportColumnOperation = t('wallet.list.exportColumnOperation')
    const exportColumnType = t('wallet.list.exportColumnType')
    const exportColumnDate = t('wallet.list.exportColumnDate')
    const exportColumnInvoice = t('wallet.list.exportColumnInvoice')
    const exportColumnAmount = t('wallet.list.exportColumnAmount')
    const rows = filteredRows.map((tx) => ({
      [exportColumnOperation]: transactionTitle(tx),
      [exportColumnType]: tx.type === 'sale' ? t('transactions.sale') : t('transactions.expense'),
      [exportColumnDate]: dayjs(tx.date).format('DD/MM/YYYY HH:mm'),
      [exportColumnInvoice]: tx.invoice_id ? invoiceLookup[tx.invoice_id]?.invoice_number || tx.invoice_id : '—',
      [exportColumnAmount]: `${tx.type === 'sale' ? '+' : '−'}${formatAmount(tx.amount ?? 0, language)} F`,
    }))
    exportToExcel(rows, `waelly-portefeuille-${dayjs().format('YYYY-MM')}`, t('wallet.title'))
    toast.success(t('wallet.list.exportGenerated'))
  }

  const selectionBar = selectedIds.size > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-tile bg-active px-4.5 py-2.5 text-white">
      <span className="text-sm font-semibold">{t('wallet.list.selectionCount', { count: selectedIds.size })}</span>
      <span className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clearSelection}
          className="flex min-h-10 items-center rounded-full border border-white/30 px-3.5 text-[13px] font-semibold text-white"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="flex min-h-10 items-center rounded-full bg-danger-dot px-4 text-[13px] font-bold text-white"
        >
          {t('common.delete')}
        </button>
      </span>
    </div>
  )

  const deleteDialog = (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('wallet.list.deleteConfirmTitle', { count: selectedIds.size })}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteSelected} disabled={deleting}>
            {deleting ? t('products.detail.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (txError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-12 text-subtle" />
        <p className="text-sm text-subtle">{txError}</p>
        <Button variant="secondary" onClick={fetchTransactions}>
          {t('wallet.list.retry')}
        </Button>
      </div>
    )
  }

  if (loadingTx) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-soft" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[90px] animate-pulse rounded-card bg-surface-soft" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* --- Mobile (< 1024px) --- */}
      <div className="flex flex-col gap-4 pb-28 lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('wallet.title')}</h1>
          <button
            type="button"
            onClick={() => {
              setMobileSelecting((v) => !v)
              setSelectedIds(new Set())
            }}
            className="flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-3.5 text-sm font-semibold text-ink"
          >
            {mobileSelecting ? t('common.cancel') : t('wallet.list.selectBulk')}
          </button>
        </div>

        <div className="flex flex-col gap-1.5 rounded-tile bg-[radial-gradient(120%_120%_at_100%_100%,#3A3AF0_0%,#1717A0_40%,#0A0A4A_85%)] p-3.5 text-white">
          <span className="text-[13px] text-navy-text">{t('wallet.list.balanceLabel', { period: periodLabel })}</span>
          <span className="text-2xl font-bold tracking-[-0.02em]">{formatAmount(summary.balance, language)} F</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5 rounded-tile border border-line bg-surface p-3.5">
            <span className="flex items-center gap-1.5 text-[13px] text-subtle">
              <span className="size-2 rounded-full bg-brand-500" />
              {t('wallet.list.entriesLabelWithPeriod', { period: periodShort })}
            </span>
            <span className="text-xl font-bold text-success">{formatAmount(summary.entries, language)}</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-tile border border-line bg-surface p-3.5">
            <span className="flex items-center gap-1.5 text-[13px] text-subtle">
              <span className="size-2 rounded-full bg-danger" />
              {t('wallet.list.exitsLabelWithPeriod', { period: periodShort })}
            </span>
            <span className="text-xl font-bold text-danger">{formatAmount(summary.exits, language)}</span>
          </div>
        </div>

        <FilterChips options={typeChips} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />

        {mobileSelecting && selectedIds.size > 0 ? (
          <span className="text-sm font-semibold text-ink-2">
            {t('wallet.list.selectionCount', { count: selectedIds.size })}
          </span>
        ) : null}

        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-subtle">{t('wallet.list.noTransactionsInPeriod')}</p>
            <Button variant="primary" asChild>
              <Link href="/wallet/new?type=sale">{t('wallet.list.addSale')}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groupedMobileRows.map((group) => (
              <React.Fragment key={group.label}>
                <span className="px-1 pb-0.5 pt-2.5 text-xs font-bold uppercase tracking-wide text-subtle">
                  {group.label}
                </span>
                {group.items.map((tx) => (
                  <SwipeableTransactionRow
                    key={tx.id}
                    className="rounded-tile border border-line"
                    exiting={exitingRowId === tx.id}
                    disabled={mobileSelecting || !isDeletableFromList(tx, tx.invoice_id ? invoiceLookup[tx.invoice_id]?.status : undefined)}
                    onRequestDelete={() => setSingleDeleteTarget(tx)}
                  >
                    <label
                      onClick={mobileSelecting ? undefined : () => setMobileDetailTransaction(tx)}
                      className="flex min-h-11 items-center gap-3 bg-surface p-3.5"
                    >
                      {mobileSelecting ? (
                        <input
                          type="checkbox"
                          aria-label={t('wallet.list.selectRowAria', { name: transactionTitle(tx) })}
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleRow(tx.id)}
                          className="size-[22px] accent-brand-500"
                        />
                      ) : null}
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-tile text-lg font-bold ${
                          tx.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                        }`}
                      >
                        {tx.type === 'sale' ? '+' : '−'}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-ink">{transactionTitle(tx)}</span>
                        <span className="truncate text-xs text-subtle">
                          {tx.type === 'sale' ? t('transactions.sale') : t('transactions.expense')} ·{' '}
                          {tx.invoice_id
                            ? t('wallet.list.invoiceNumberPrefix', { number: invoiceLookup[tx.invoice_id]?.invoice_number || '' }).trim()
                            : formatDate(tx.date, language, 'HH:mm')}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-sm font-bold ${tx.type === 'sale' ? 'text-success' : 'text-danger'}`}
                      >
                        {tx.type === 'sale' ? '+' : '−'}
                        {formatAmount(tx.amount ?? 0, language)}
                      </span>
                    </label>
                  </SwipeableTransactionRow>
                ))}
              </React.Fragment>
            ))}
            {mobileVisibleCount < filteredRows.length ? (
              <button
                type="button"
                onClick={() => setMobileVisibleCount((c) => c + PAGE_SIZE)}
                className="flex min-h-11 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink"
              >
                {t('wallet.list.loadMore', { count: filteredRows.length - mobileVisibleCount })}
              </button>
            ) : null}
          </div>
        )}

        {mobileSelecting && selectedIds.size > 0 ? (
          <div className="fixed inset-x-0 bottom-[112px] z-30 border-t border-line bg-surface px-5 py-3">
            <Button
              variant="danger"
              className="w-full bg-danger text-white"
              onClick={() => setDeleteDialogOpen(true)}
            >
              {t('wallet.list.deleteSelectionCount', { count: selectedIds.size })}
            </Button>
          </div>
        ) : null}
      </div>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('wallet.title')}</h1>
            <span className="text-sm text-subtle">{t('wallet.list.subtitleDesktop')}</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="glass" asChild>
              <Link href="/wallet/new?type=expense">{t('wallet.list.addExpense')}</Link>
            </Button>
            <Button variant="primary" asChild>
              <Link href="/wallet/new?type=sale">{t('wallet.list.addSale')}</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 rounded-[24px] bg-[radial-gradient(120%_120%_at_100%_100%,#3A3AF0_0%,#1717A0_40%,#0A0A4A_85%)] p-5 text-white shadow-[0_14px_30px_rgba(16,16,120,0.24)]">
            <span className="text-[13px] text-navy-text">{t('wallet.list.balanceLabel', { period: periodLabel })}</span>
            <span className="text-[30px] font-bold tracking-[-0.02em]">{formatAmount(summary.balance, language)} F</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[24px] bg-surface p-5 shadow-card">
            <span className="text-[13px] text-subtle">{t('wallet.list.entriesLabel')}</span>
            <span className="text-[30px] font-bold tracking-[-0.02em] text-success">
              +{formatAmount(summary.entries, language)} F
            </span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-[24px] bg-surface p-5 shadow-card">
            <span className="text-[13px] text-subtle">{t('wallet.list.exitsLabel')}</span>
            <span className="text-[30px] font-bold tracking-[-0.02em] text-danger">
              −{formatAmount(summary.exits, language)} F
            </span>
          </div>
        </div>

        <Card className="flex flex-col gap-3.5 rounded-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips options={typeChips} value={typeFilter} onChange={(v) => setTypeFilter(v as TypeFilter)} />
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="wallet-period" className="sr-only">
                {t('wallet.list.periodSelectAria')}
              </label>
              <select
                id="wallet-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="h-[42px] rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink"
              >
                <option value="all">{t('wallet.list.periodAll')}</option>
                <option value="current">{formatDate(dayjs().toISOString(), language, 'MMMM YYYY')}</option>
                <option value="previous">{formatDate(dayjs().subtract(1, 'month').toISOString(), language, 'MMMM YYYY')}</option>
                <option value="30d">{t('wallet.list.periodLast30Days')}</option>
                <option value="custom">{t('wallet.list.periodCustomOption')}</option>
              </select>
              {period === 'custom' ? (
                <>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-[42px] rounded-full border border-line-strong bg-surface px-3 text-[13px] text-ink"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-[42px] rounded-full border border-line-strong bg-surface px-3 text-[13px] text-ink"
                  />
                </>
              ) : null}
              <button
                type="button"
                onClick={handleExport}
                className="flex h-[42px] items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink"
              >
                <Download className="size-4" />
                {t('wallet.list.export')}
              </button>
            </div>
          </div>

          {selectionBar}

          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-subtle">{t('wallet.list.noTransactionsInPeriod')}</p>
              <Button variant="primary" asChild>
                <Link href="/wallet/new?type=sale">{t('wallet.list.addSale')}</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                      <th className="w-9 px-2 py-2.5">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={allOnPageSelected}
                          aria-label={t('wallet.list.selectAllPageAria')}
                          disabled={selectablePaginatedRows.length === 0}
                          onClick={toggleSelectAllOnPage}
                          className={`flex size-6 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40 ${
                            allOnPageSelected ? 'bg-brand-500' : 'border-[1.5px] border-line-strong bg-surface'
                          }`}
                        >
                          {allOnPageSelected ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
                        </button>
                      </th>
                      <th className="px-2 py-2.5">{t('wallet.list.columnOperation')}</th>
                      <th className="px-2 py-2.5">{t('transactions.type')}</th>
                      <th className="px-2 py-2.5">{t('wallet.list.columnDate')}</th>
                      <th className="px-2 py-2.5">{t('transactions.detail.invoice')}</th>
                      <th className="px-2 py-2.5 text-right">{t('transactions.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((tx) => {
                      const checked = selectedIds.has(tx.id)
                      const selectable = canSelectForDeletion(tx)
                      return (
                        <tr
                          key={tx.id}
                          onClick={() => setDesktopDetailTransaction(tx)}
                          className={`cursor-pointer border-t border-divider hover:bg-surface-soft ${checked ? 'bg-brand-50' : ''}`}
                        >
                          <td className="px-2 py-2.5">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              aria-label={
                                selectable
                                  ? t('wallet.list.selectRowAria', { name: transactionTitle(tx) })
                                  : t('wallet.list.notSelectableAria', { name: transactionTitle(tx) })
                              }
                              disabled={!selectable}
                              title={selectable ? undefined : t('wallet.list.notSelectableTitle')}
                              onClick={(e) => { e.stopPropagation(); toggleRow(tx.id) }}
                              className={`flex size-6 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40 ${
                                checked ? 'bg-brand-500' : 'border-[1.5px] border-line-strong bg-surface'
                              }`}
                            >
                              {checked ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
                            </button>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="flex items-center gap-3">
                              <span
                                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                                  tx.type === 'sale'
                                    ? 'bg-success-bg text-success-strong'
                                    : 'bg-danger-bg text-danger-strong'
                                }`}
                              >
                                {tx.type === 'sale' ? (
                                  <ArrowUpRight className="size-4" strokeWidth={2.2} />
                                ) : (
                                  <ArrowDownLeft className="size-4" strokeWidth={2.2} />
                                )}
                              </span>
                              <span className="font-semibold text-ink">{transactionTitle(tx)}</span>
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <StatusBadge
                              tone={tx.type === 'sale' ? 'success' : 'danger'}
                              label={tx.type === 'sale' ? t('transactions.sale') : t('transactions.expense')}
                            />
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-ink-3">
                            {formatDate(tx.date, language, 'D MMM · HH:mm')}
                          </td>
                          <td className="px-2 py-2.5">
                            {tx.invoice_id ? (
                              <Link
                                href={`/invoices/${tx.invoice_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-semibold text-brand-700"
                              >
                                {invoiceLookup[tx.invoice_id]?.invoice_number || t('wallet.list.viewInvoiceShort')}
                              </Link>
                            ) : (
                              <span className="text-ink-3">—</span>
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-2 py-2.5 text-right font-bold ${
                              tx.type === 'sale' ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {tx.type === 'sale' ? '+' : '−'}
                            {formatAmount(tx.amount ?? 0, language)} F
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                summary={t('wallet.list.shownOfTotal', { shown: paginatedRows.length, total: filteredRows.length })}
              />
            </>
          )}
        </Card>
      </div>

      {deleteDialog}

      <TransactionDetailSheet
        transaction={mobileDetailTransaction}
        onOpenChange={(open) => { if (!open) setMobileDetailTransaction(null) }}
        invoiceEntry={mobileDetailTransaction?.invoice_id ? invoiceLookup[mobileDetailTransaction.invoice_id] : undefined}
        onRequestDelete={(t) => {
          setMobileDetailTransaction(null)
          setSingleDeleteTarget(t)
        }}
      />

      <TransactionDetailsDialog
        transaction={desktopDetailTransaction}
        onOpenChange={(open) => { if (!open) setDesktopDetailTransaction(null) }}
        invoiceEntry={desktopDetailTransaction?.invoice_id ? invoiceLookup[desktopDetailTransaction.invoice_id] : undefined}
        onRequestDelete={(t) => {
          setDesktopDetailTransaction(null)
          setSingleDeleteTarget(t)
        }}
      />

      <DeleteTransactionDialog
        transaction={singleDeleteTarget}
        onOpenChange={(open) => { if (!open) setSingleDeleteTarget(null) }}
        onConfirm={handleConfirmSingleDelete}
      />
    </div>
  )
}
