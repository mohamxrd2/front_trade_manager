'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { toast } from 'sonner'
import { AlertCircle, Download, Loader2, Plus, Search, Users } from 'lucide-react'

import {
  getInvoiceDashboard,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  duplicateInvoice,
  deleteInvoice,
  getInvoicePdfBlob,
  type Invoice,
  type InvoiceDashboardStats,
  type InvoiceStatus,
} from '@/lib/services/invoices'
import { invalidateInvoices } from '@/lib/invalidate'
import { exportToExcel } from '@/lib/utils/export'
import { getInvoiceStatusDisplay } from '@/components/invoices/invoice-status'
import { InvoicePreviewCard } from '@/components/invoices/invoice-preview-card'
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
import { Button, Card, FilterChips, Pagination, StatusBadge } from '@/components/waelly'

dayjs.locale('fr')

const PAGE_SIZE = 10

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const initials = (name: string): string => (name.trim() ? name.trim().slice(0, 2).toUpperCase() : 'NA')

const AVATAR_TINTS = [
  { bg: 'bg-brand-100', text: 'text-brand-600' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]

type FilterValue = 'all' | 'draft' | 'unpaid' | 'paid'

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'unpaid', label: 'Envoyées' },
  { value: 'paid', label: 'Payées' },
]

/**
 * Factures — reprend design/maquettes/ordinateur/Web-Factures.dc.html
 * (≥ 1024px) et design/maquettes/mobile/Factures.dc.html (< 768px).
 * Remplace InvoiceDashboardCards/InvoiceFilters/InvoiceTable/
 * InvoiceStatusBadge/DeleteInvoiceButton (orphelins après ce remplacement).
 *
 * Écarts / choix assumés :
 * - Le bouton "Supprimer" n'apparaît dans aucune des deux maquettes (grille
 *   à 3 boutons : PDF / Dupliquer / Marquer payée-Envoyer) : retiré de cet
 *   écran. La suppression existe toujours côté API (deleteInvoice) si vous
 *   voulez qu'elle revienne quelque part.
 * - "PDF" réutilise le PDF déjà généré côté backend (getInvoicePdfBlob, déjà
 *   utilisé par /invoices/[id]) plutôt que html2pdf.js : un rendu serveur
 *   fidèle au thème existe déjà et fonctionne, pas de raison d'en construire
 *   un second moins fiable (texte raster, sauts de page approximatifs).
 * - "Payé ce mois" n'affiche pas de compteur ni de "↑ 14 %" : l'API ne
 *   fournit ni un total de factures payées CE MOIS (filtre de date du
 *   backend = date d'émission, pas date de paiement) ni de comparaison avec
 *   le mois précédent.
 */
export default function InvoicesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')
  const clientFilter = searchParams.get('client')

  const [stats, setStats] = React.useState<InvoiceDashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = React.useState(true)
  const [draftStats, setDraftStats] = React.useState({ count: 0, total: 0 })
  const [allCount, setAllCount] = React.useState(0)

  const [statusFilter, setStatusFilter] = React.useState<FilterValue>('all')
  const [search, setSearch] = React.useState('')

  const [page, setPage] = React.useState(1)
  const [invoices, setInvoices] = React.useState<Invoice[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [loadingInvoices, setLoadingInvoices] = React.useState(true)
  const [invoicesError, setInvoicesError] = React.useState<string | null>(null)

  const [mobileInvoices, setMobileInvoices] = React.useState<Invoice[]>([])
  const [mobilePage, setMobilePage] = React.useState(1)
  const [mobileTotal, setMobileTotal] = React.useState(0)
  const [mobileLoading, setMobileLoading] = React.useState(true)
  const [mobileLoadingMore, setMobileLoadingMore] = React.useState(false)

  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null)
  const [loadingSelected, setLoadingSelected] = React.useState(false)
  const [statusChanging, setStatusChanging] = React.useState(false)
  const [duplicating, setDuplicating] = React.useState(false)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchStats = React.useCallback(async () => {
    setLoadingStats(true)
    try {
      setStats(await getInvoiceDashboard())
    } finally {
      setLoadingStats(false)
    }
  }, [])

  const fetchDraftStats = React.useCallback(async () => {
    try {
      let currentPage = 1
      let count = 0
      let total = 0
      for (;;) {
        const { invoices: drafts, pages } = await getInvoices({ status: 'draft', page: currentPage, per_page: 100 })
        count += drafts.length
        total += drafts.reduce((sum, inv) => sum + Number(inv.total), 0)
        if (currentPage >= pages) break
        currentPage += 1
      }
      setDraftStats({ count, total })
    } catch {
      setDraftStats({ count: 0, total: 0 })
    }
  }, [])

  const fetchAllCount = React.useCallback(async () => {
    try {
      const { total } = await getInvoices({ per_page: 1 })
      setAllCount(total)
    } catch {
      setAllCount(0)
    }
  }, [])

  const fetchInvoices = React.useCallback(async () => {
    setLoadingInvoices(true)
    setInvoicesError(null)
    try {
      const { invoices: data, total } = await getInvoices({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
        client_id: clientFilter || undefined,
        page,
        per_page: PAGE_SIZE,
      })
      setInvoices(data)
      setTotalCount(total)
    } catch (err: unknown) {
      setInvoicesError((err as Error).message || 'Impossible de charger les factures.')
    } finally {
      setLoadingInvoices(false)
    }
  }, [statusFilter, search, clientFilter, page])

  const fetchMobilePage = React.useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setMobileLoadingMore(true)
      else setMobileLoading(true)
      try {
        const { invoices: data, total } = await getInvoices({
          status: statusFilter === 'all' ? undefined : statusFilter,
          client_id: clientFilter || undefined,
          page: targetPage,
          per_page: PAGE_SIZE,
        })
        setMobileInvoices((prev) => (append ? [...prev, ...data] : data))
        setMobileTotal(total)
        setMobilePage(targetPage)
      } finally {
        setMobileLoading(false)
        setMobileLoadingMore(false)
      }
    },
    [statusFilter, clientFilter]
  )

  React.useEffect(() => {
    fetchStats()
    fetchDraftStats()
    fetchAllCount()
  }, [fetchStats, fetchDraftStats, fetchAllCount])

  React.useEffect(() => {
    setPage(1)
  }, [statusFilter, search])

  React.useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  React.useEffect(() => {
    fetchMobilePage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  // Sélection par défaut : la première facture de la page courante, si
  // aucune n'est déjà choisie dans l'URL.
  React.useEffect(() => {
    if (!selectedId && invoices.length > 0) {
      router.replace(`/invoices?id=${invoices[0].id}`, { scroll: false })
    }
  }, [selectedId, invoices, router])

  React.useEffect(() => {
    if (!selectedId) {
      setSelectedInvoice(null)
      return
    }
    let cancelled = false
    setLoadingSelected(true)
    getInvoiceById(selectedId)
      .then((inv) => {
        if (!cancelled) setSelectedInvoice(inv)
      })
      .catch(() => {
        if (!cancelled) setSelectedInvoice(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingSelected(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const selectInvoice = (id: string) => {
    router.replace(`/invoices?id=${id}`, { scroll: false })
  }

  const refreshAfterMutation = async () => {
    await Promise.all([fetchStats(), fetchDraftStats(), fetchInvoices()])
    fetchMobilePage(1, false)
  }

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!selectedInvoice) return
    const previous = selectedInvoice
    setStatusChanging(true)
    // Mise à jour optimiste
    setSelectedInvoice({ ...previous, status: newStatus })
    try {
      const updated = await updateInvoiceStatus(previous.id, newStatus)
      setSelectedInvoice(updated)
      invalidateInvoices({ paid: newStatus === 'paid' })
      toast.success(newStatus === 'paid' ? 'Facture marquée comme payée' : 'Facture envoyée')
      await refreshAfterMutation()
    } catch (err: unknown) {
      setSelectedInvoice(previous)
      const error = err as { status?: number; errors?: unknown; message?: string }
      if (error.status === 422 && Array.isArray(error.errors) && error.errors.length > 0) {
        error.errors.forEach((message) => toast.error(String(message)))
      } else {
        toast.error(error.message || 'Échec de la mise à jour du statut')
      }
    } finally {
      setStatusChanging(false)
    }
  }

  const handleDuplicate = async () => {
    if (!selectedInvoice) return
    setDuplicating(true)
    try {
      const copy = await duplicateInvoice(selectedInvoice.id)
      invalidateInvoices()
      toast.success('Facture dupliquée')
      await refreshAfterMutation()
      selectInvoice(copy.id)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Échec de la duplication')
    } finally {
      setDuplicating(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return
    setDeleting(true)
    try {
      const result = await deleteInvoice(selectedInvoice.id)
      if (result.success) {
        invalidateInvoices()
        toast.success('Facture supprimée')
        setDeleteDialogOpen(false)
        router.replace('/invoices', { scroll: false })
        await refreshAfterMutation()
      } else {
        toast.error(result.message)
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Échec de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!selectedInvoice) return
    setGeneratingPdf(true)
    try {
      const blob = await getInvoicePdfBlob(selectedInvoice.id, 'download')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Facture-${selectedInvoice.invoice_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Échec de la génération du PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleExport = async () => {
    try {
      let currentPage = 1
      let all: Invoice[] = []
      for (;;) {
        const { invoices: pageData, pages } = await getInvoices({
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search.trim() || undefined,
          client_id: clientFilter || undefined,
          page: currentPage,
          per_page: 100,
        })
        all = all.concat(pageData)
        if (currentPage >= pages) break
        currentPage += 1
      }
      if (all.length === 0) {
        toast.error('Aucune facture à exporter')
        return
      }
      const rows = all.map((inv) => ({
        'N°': inv.invoice_number,
        Client: inv.client?.name ?? '',
        Date: dayjs(inv.issued_at).format('DD/MM/YYYY'),
        Statut: getInvoiceStatusDisplay(inv).label,
        Montant: `${formatAmount(Number(inv.total))} F`,
      }))
      exportToExcel(rows, `waelly-factures-${dayjs().format('YYYY-MM')}`, 'Factures')
      toast.success('Export généré')
    } catch {
      toast.error("Échec de l'export")
    }
  }

  const unpaidAmount = stats?.unpaid_amount ?? 0
  const unpaidCount = stats?.unpaid_count ?? 0
  const thisMonthTotal = stats?.this_month_total ?? 0

  const summaryCards = (
    <>
      <div className="flex flex-col gap-1.5 rounded-[24px] bg-[linear-gradient(150deg,#5B3FE6_0%,#7A5CF5_60%,#B7A4FF_100%)] p-5 text-white shadow-[0_14px_30px_rgba(91,63,230,0.28)]">
        <span className="text-sm text-[#F0ECFF]">À encaisser</span>
        <span className="text-[30px] font-bold tracking-[-0.02em]">{formatAmount(unpaidAmount)} F</span>
        <span className="text-[13px] text-[#F0ECFF]">
          {unpaidCount} facture{unpaidCount > 1 ? 's' : ''} envoyée{unpaidCount > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[24px] bg-surface p-5 shadow-card">
        <span className="text-sm text-subtle">Payé ce mois</span>
        <span className="text-[30px] font-bold tracking-[-0.02em] text-success">{formatAmount(thisMonthTotal)} F</span>
      </div>
      <div className="flex flex-col gap-1.5 rounded-[24px] bg-surface p-5 shadow-card">
        <span className="text-sm text-subtle">Brouillons</span>
        <span className="text-[30px] font-bold tracking-[-0.02em] text-ink">{draftStats.count}</span>
        <span className="text-[13px] text-subtle">{formatAmount(draftStats.total)} F en préparation</span>
      </div>
    </>
  )

  const previewActions = selectedInvoice ? (
    <div className={`grid gap-2 ${selectedInvoice.status === 'paid' || selectedInvoice.status === 'cancelled' ? 'grid-cols-2' : 'grid-cols-3'}`}>
      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={generatingPdf}
        className="flex min-h-[46px] items-center justify-center rounded-full border border-line-strong bg-surface text-[13px] font-bold text-ink disabled:opacity-60"
      >
        {generatingPdf ? <Loader2 className="size-4 animate-spin" /> : 'PDF'}
      </button>
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={duplicating}
        className="flex min-h-[46px] items-center justify-center rounded-full border border-line-strong bg-surface text-[13px] font-bold text-ink disabled:opacity-60"
      >
        {duplicating ? '…' : 'Dupliquer'}
      </button>
      {selectedInvoice.status === 'draft' ? (
        <button
          type="button"
          onClick={() => handleStatusChange('unpaid')}
          disabled={statusChanging}
          className="flex min-h-[46px] items-center justify-center rounded-full bg-active text-[13px] font-bold text-white disabled:opacity-60"
        >
          {statusChanging ? '…' : 'Envoyer'}
        </button>
      ) : selectedInvoice.status === 'paid' || selectedInvoice.status === 'cancelled' ? null : (
        <button
          type="button"
          onClick={() => handleStatusChange('paid')}
          disabled={statusChanging}
          className="flex min-h-[46px] items-center justify-center rounded-full bg-active text-[13px] font-bold text-white disabled:opacity-60"
        >
          {statusChanging ? '…' : 'Marquer payée'}
        </button>
      )}
    </div>
  ) : null

  const deleteDialog = selectedInvoice ? (
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la facture {selectedInvoice.invoice_number} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est définitive. Les factures payées ne peuvent pas être supprimées — annulez-les à la
            place.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteInvoice} disabled={deleting}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null

  return (
    <div className="flex flex-col gap-5">
      {/* --- Mobile (< 1024px) --- */}
      <div className="flex flex-col gap-4 pb-28 lg:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Factures</h1>
          <Button variant="secondary" asChild>
            <Link href="/clients">
              <Users className="size-[18px]" strokeWidth={1.9} />
              Clients
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5 rounded-tile bg-hero p-3.5 text-white">
            <span className="text-[13px] text-navy-text">À encaisser</span>
            <span className="text-xl font-bold">{formatAmount(unpaidAmount)}</span>
            <span className="text-xs font-semibold text-brand-200">
              {unpaidCount} facture{unpaidCount > 1 ? 's' : ''} envoyée{unpaidCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-tile border border-line bg-surface p-3.5">
            <span className="text-[13px] text-subtle">Payé ce mois</span>
            <span className="text-xl font-bold text-success">{formatAmount(thisMonthTotal)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <FilterChips
            options={FILTERS.map((f) => (f.value === 'all' ? { ...f, label: `Toutes · ${allCount}` } : f))}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as FilterValue)}
            className="flex-nowrap"
          />
        </div>

        {mobileLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-tile bg-surface-soft" />
            ))}
          </div>
        ) : mobileInvoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-subtle">Aucune facture pour l&apos;instant</p>
            <Button variant="primary" asChild>
              <Link href="/invoices/new">Nouvelle facture</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {mobileInvoices.map((inv) => {
              const statusDisplay = getInvoiceStatusDisplay(inv)
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex flex-col gap-2.5 rounded-tile border border-line bg-surface p-3.5"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-subtle">{inv.invoice_number}</span>
                    <StatusBadge
                      tone={statusDisplay.tone}
                      label={statusDisplay.label}
                      className={statusDisplay.strikethrough ? 'line-through' : ''}
                    />
                  </span>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-bold text-ink">{inv.client?.name}</span>
                      <span className="text-xs text-subtle">{dayjs(inv.issued_at).format('D MMM YYYY')}</span>
                    </span>
                    <span className="shrink-0 text-[17px] font-bold text-ink">
                      {formatAmount(Number(inv.total))} F
                    </span>
                  </span>
                </Link>
              )
            })}
            {mobileInvoices.length < mobileTotal ? (
              <button
                type="button"
                onClick={() => fetchMobilePage(mobilePage + 1, true)}
                disabled={mobileLoadingMore}
                className="flex min-h-11 items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink"
              >
                {mobileLoadingMore ? 'Chargement…' : `Charger plus (${mobileTotal - mobileInvoices.length} restante(s))`}
              </button>
            ) : null}
          </div>
        )}

        <Link
          href="/invoices/new"
          aria-label="Nouvelle facture"
          className="fixed bottom-[100px] right-5 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-500 px-5 text-[15px] font-bold text-white shadow-button"
        >
          <Plus className="size-5" strokeWidth={2.2} />
          Nouvelle facture
        </Link>
      </div>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">Factures</h1>
            <span className="text-sm text-subtle">Créez, envoyez et suivez vos paiements</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="glass" onClick={handleExport}>
              <Download className="size-[18px]" />
              Exporter (Excel)
            </Button>
            <Button variant="primary" asChild>
              <Link href="/invoices/new">
                <Plus className="size-[18px]" strokeWidth={2.2} />
                Nouvelle facture
              </Link>
            </Button>
          </div>
        </div>

        {loadingStats ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[110px] animate-pulse rounded-[24px] bg-surface-soft" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{summaryCards}</div>
        )}

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex flex-[3_1_560px] flex-col gap-3.5 rounded-panel p-[22px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FilterChips
                options={FILTERS.map((f) => (f.value === 'all' ? { ...f, label: `Toutes · ${allCount}` } : f))}
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as FilterValue)}
              />
              <div className="relative flex">
                <Search className="pointer-events-none absolute left-3.5 top-2.5 size-[18px] text-subtle" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Numéro ou client"
                  className="h-11 w-[220px] rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink outline-none"
                />
              </div>
            </div>

            {invoicesError ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertCircle className="size-10 text-subtle" />
                <p className="text-sm text-subtle">{invoicesError}</p>
                <Button variant="secondary" onClick={fetchInvoices}>
                  Réessayer
                </Button>
              </div>
            ) : loadingInvoices ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm text-subtle">Aucune facture pour l&apos;instant</p>
                <Button variant="primary" asChild>
                  <Link href="/invoices/new">Nouvelle facture</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                        <th className="px-2 py-2.5">N°</th>
                        <th className="px-2 py-2.5">Client</th>
                        <th className="px-2 py-2.5">Date</th>
                        <th className="px-2 py-2.5">Statut</th>
                        <th className="px-2 py-2.5 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv, i) => {
                        const statusDisplay = getInvoiceStatusDisplay(inv)
                        const active = inv.id === selectedId
                        const tint = AVATAR_TINTS[i % AVATAR_TINTS.length]
                        return (
                          <tr
                            key={inv.id}
                            onClick={() => selectInvoice(inv.id)}
                            className={`cursor-pointer border-t border-divider ${active ? 'bg-brand-50' : ''}`}
                          >
                            <td className="px-2 py-0">
                              <button
                                type="button"
                                aria-pressed={active}
                                className="flex min-h-[52px] items-center bg-transparent text-sm font-bold text-brand-700"
                              >
                                {inv.invoice_number}
                              </button>
                            </td>
                            <td className="px-2 py-0">
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={`flex size-[34px] shrink-0 items-center justify-center rounded-full text-xs font-bold ${tint.bg} ${tint.text}`}
                                >
                                  {initials(inv.client?.name ?? '')}
                                </span>
                                <span className="font-semibold text-ink">{inv.client?.name}</span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-0 text-ink-3">
                              {dayjs(inv.issued_at).format('D MMM YYYY')}
                            </td>
                            <td className="px-2 py-0">
                              <StatusBadge
                                tone={statusDisplay.tone}
                                label={statusDisplay.label}
                                className={statusDisplay.strikethrough ? 'line-through' : ''}
                              />
                            </td>
                            <td className="whitespace-nowrap px-2 py-0 text-right font-bold text-ink">
                              {formatAmount(Number(inv.total))} F
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
                  summary={`${invoices.length} facture(s) affichée(s) sur ${totalCount}`}
                />
              </>
            )}
          </Card>

          <aside
            aria-label="Aperçu de la facture"
            className="glass-panel flex flex-[2_1_340px] flex-col gap-3.5 rounded-panel p-[18px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Aperçu</h2>
              {selectedInvoice ? (
                (() => {
                  const statusDisplay = getInvoiceStatusDisplay(selectedInvoice)
                  return (
                    <StatusBadge
                      tone={statusDisplay.tone}
                      label={statusDisplay.label}
                      className={statusDisplay.strikethrough ? 'line-through' : ''}
                    />
                  )
                })()
              ) : null}
            </div>

            {loadingSelected || !selectedInvoice ? (
              <div className="h-[420px] animate-pulse rounded-[20px] bg-surface-soft" />
            ) : (
              <InvoicePreviewCard invoice={selectedInvoice} />
            )}

            {previewActions}

            {selectedInvoice && selectedInvoice.status !== 'paid' ? (
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="self-start text-[13px] font-semibold text-danger-strong"
              >
                Supprimer la facture
              </button>
            ) : null}
          </aside>
        </div>
      </div>

      {deleteDialog}
    </div>
  )
}
