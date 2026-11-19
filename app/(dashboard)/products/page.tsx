'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, Barcode, ChevronRight, Download, Plus, ScanLine, Search } from 'lucide-react'

import { useUserStats, useArticles } from '@/lib/hooks/useArticles'
import { MediaImage } from '@/components/media/media-image'
import { exportToExcel, formatProductsForExport } from '@/lib/utils/export'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, Card, FilterChips } from '@/components/waelly'
import { usePermissions } from '@/hooks/usePermissions'
import { useBarcodeWedge } from '@/hooks/useBarcodeWedge'
import { BarcodeScanner } from '@/components/barcode/barcode-scanner'
import { GenerateMissingDialog } from '@/components/barcode/generate-missing-dialog'
import { primeScanSound } from '@/lib/barcode/camera'
import { articleHasBarcode, findByBarcode, missingBarcodeCount } from '@/lib/barcode/scan-to-cart'
import { lookupBarcode, serverErrorMessage } from '@/lib/services/barcodes'
import { invalidateArticles } from '@/lib/hooks/useCache'

const PAGE_SIZE = 10

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const initials = (name: string): string => name.slice(0, 2).toUpperCase()

/** "15 000 F" si prix unique, "15 000 – 25 000 F" pour un article variable à prix multiples. */
const priceRangeLabel = (
  article: { type: string; sale_price: number; price_max?: number | null },
  language: AppLanguage
): string => {
  if (article.type !== 'variable' || !article.price_max || article.price_max === article.sale_price) {
    return `${formatAmount(article.sale_price, language)} F`
  }
  return `${formatAmount(article.sale_price, language)} – ${formatAmount(article.price_max, language)} F`
}

/**
 * Stock faible si l'agrégat article l'indique, OU si au moins une variation
 * est elle-même sous son seuil — l'agrégat seul peut masquer une variation
 * en tension quand les autres compensent dans la moyenne.
 */
const isLowStock = (article: { low_stock: boolean; variations?: { low_stock: boolean }[] }): boolean =>
  article.low_stock || (article.variations?.some((v) => v.low_stock) ?? false)

const THUMB_TINTS = [
  { bg: 'bg-brand-100', text: 'text-brand-700' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]

type FilterValue = 'all' | 'low' | 'variable' | 'simple'

/**
 * Stock — reprend design/maquettes/ordinateur/Web-Stock.dc.html (≥ 1024px)
 * et design/maquettes/mobile/Stock.dc.html (< 768px).
 */
export default function ProductsPage() {
  const { stats, error: statsError, isLoading: isLoadingStats } = useUserStats()
  const { articles, error: articlesError, isLoading: isLoadingArticles } = useArticles()
  const { currency } = useCurrency()
  const { t, language } = useTranslation()
  const { can } = usePermissions()
  const canEditStock = can('stock.edit')
  const canExport = can('exports.download')

  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<FilterValue>('all')
  const [page, setPage] = React.useState(1)
  const router = useRouter()
  const [scannerOpen, setScannerOpen] = React.useState(false)
  const [generateOpen, setGenerateOpen] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())

  const isLoading = isLoadingStats || isLoadingArticles
  const error = statsError || articlesError

  const lowStockCount = articles.filter((a) => isLowStock(a)).length

  const filteredArticles = React.useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = article.name.toLowerCase().includes(search.trim().toLowerCase()) || articleHasBarcode(article, search)
      const matchesFilter =
        filter === 'all' ||
        (filter === 'low' && isLowStock(article)) ||
        (filter === 'variable' && article.type === 'variable') ||
        (filter === 'simple' && article.type === 'simple')
      return matchesSearch && matchesFilter
    })
  }, [articles, search, filter])

  React.useEffect(() => {
    setPage(1)
  }, [search, filter])

  const pageCount = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE))
  const paginatedArticles = filteredArticles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /** « Ajouter par code-barre » (scanner, douchette) : fiche du produit s'il existe, sinon ajout avec le code rempli. */
  const openFromBarcode = async (code: string) => {
    let found = findByBarcode(articles, code)
    if (!found) {
      try {
        found = await lookupBarcode(code)
      } catch (error) {
        toast.error(serverErrorMessage(error) || t('barcode.sale.lookupFailed'))
        return
      }
    }
    if (found) {
      router.push(`/products/${found.article.id}`)
    } else if (canEditStock) {
      router.push(`/products/new?barcode=${encodeURIComponent(code)}`)
    } else {
      toast.error(t('barcode.sale.notFoundTitle'), { description: t('barcode.sale.notFoundBody', { code }) })
    }
  }

  useBarcodeWedge((code) => void openFromBarcode(code), { enabled: !scannerOpen && !generateOpen })

  const openScanner = () => {
    primeScanSound()
    setScannerOpen(true)
  }

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const pageIds = paginatedArticles.map((a) => String(a.id))
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const generateLabel = selected.size > 0 ? t('barcode.stock.generateMissingSelection') : t('barcode.stock.generateMissing')
  // « Générer les codes manquants » seulement s'il manque au moins un code (dans la sélection, s'il y en a une).
  const missingCodes = missingBarcodeCount(selected.size > 0 ? articles.filter((a) => selected.has(String(a.id))) : articles)
  const canGenerateMissing = canEditStock && missingCodes > 0

  const handleExport = () => {
    void exportToExcel(formatProductsForExport(articles, currency), 'stock-waelly', 'Stock')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-soft" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[90px] animate-pulse rounded-card bg-surface-soft" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-panel bg-surface-soft" />
      </div>
    )
  }

  if (error) {
    const isAuthError = error.message.includes('Non authentifié') // i18n:allow — sentinelle interne (lib/services/articles.ts), jamais affichée
    if (isAuthError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-subtle" />
          <p className="text-lg font-medium">{t('products.authRedirect')}</p>
        </div>
      )
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('products.loadError')}</AlertTitle>
        <AlertDescription>{error.message || t('products.list.genericLoadError')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* --- En-tête mobile --- */}
      <div className="flex items-center justify-between md:hidden">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('products.list.title')}</h1>
          <span className="text-[13px] text-subtle">
            {t('products.list.subtitleMobile', {
              count: articles.length,
              value: formatAmount(stats?.total_stock_value ?? 0, language),
              currency,
            })}
          </span>
        </div>
        {canEditStock ? (
          <Link
            href="/products/new"
            aria-label={t('products.list.addArticle')}
            className="flex size-12 items-center justify-center rounded-full bg-orb text-white shadow-button"
          >
            <Plus className="size-6" strokeWidth={2} />
          </Link>
        ) : null}
      </div>

      {/* --- En-tête ordinateur --- */}
      <div className="hidden flex-wrap items-center justify-between gap-3.5 lg:flex">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('products.list.title')}</h1>
          <span className="text-sm text-subtle">{t('products.list.subtitleDesktop')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={openScanner} aria-label={t('barcode.stock.addByBarcodeAria')}>
            <ScanLine className="size-[18px]" aria-hidden="true" />
            {t('barcode.stock.addByBarcode')}
          </Button>
          {canGenerateMissing ? (
            <Button variant="secondary" onClick={() => setGenerateOpen(true)}>
              <Barcode className="size-[18px]" aria-hidden="true" />
              {generateLabel}
            </Button>
          ) : null}
          {canExport ? (
            <Button variant="secondary" onClick={handleExport}>
              <Download className="size-[18px]" />
              {t('products.list.exportExcel')}
            </Button>
          ) : null}
          {canEditStock ? (
            <Button variant="primary" asChild>
              <Link href="/products/new">
                <Plus className="size-[18px]" strokeWidth={2.2} />
                {t('products.list.addArticle')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* --- KPI (pas de donnée réelle pour "Réappros ce mois" : omis) --- */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 rounded-card bg-hero p-[18px] text-white">
          <span className="text-[13px] text-navy-text">{t('products.list.kpiStockValue')}</span>
          <span className="text-2xl font-bold tracking-[-0.02em]">
            {formatAmount(stats?.total_stock_value ?? 0, language)} {currency}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card">
          <span className="text-[13px] text-subtle">{t('products.list.kpiArticles')}</span>
          <span className="text-2xl font-bold tracking-[-0.02em] text-ink">{articles.length}</span>
        </div>
        <div className="flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card">
          <span className="text-[13px] text-subtle">{t('products.list.kpiLowStock')}</span>
          <span className="text-2xl font-bold tracking-[-0.02em] text-danger-strong">{lowStockCount}</span>
        </div>
      </div>

      {/* --- Recherche mobile + chips (desktop a sa propre barre ci-dessous) --- */}
      <div className="flex flex-col gap-3 lg:hidden">
        <div className="relative flex">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('products.list.searchPlaceholder')}
            className="h-12 w-full rounded-field border border-line-strong bg-surface pl-11 pr-4 text-[15px] text-ink outline-none"
          />
        </div>
        <FilterChips
          value={filter}
          onChange={(v) => setFilter(v as FilterValue)}
          options={[
            { value: 'all', label: t('products.list.filterAll') },
            { value: 'low', label: t('products.list.filterLowStock', { count: lowStockCount }) },
            { value: 'variable', label: t('products.list.filterVariable') },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openScanner}
            aria-label={t('barcode.stock.addByBarcodeAria')}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-active px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <ScanLine className="size-[18px]" aria-hidden="true" />
            {t('barcode.stock.addByBarcode')}
          </button>
          {canEditStock && missingBarcodeCount(articles) > 0 ? (
            <button
              type="button"
              onClick={() => setGenerateOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Barcode className="size-[18px]" aria-hidden="true" />
              {t('barcode.stock.generateMissing')}
            </button>
          ) : null}
        </div>
      </div>

      {/* --- Liste mobile --- */}
      <div className="flex flex-col gap-2.5 lg:hidden">
        {paginatedArticles.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">{t('products.list.noArticleFound')}</p>
        ) : (
          paginatedArticles.map((article, i) => (
            <Link
              key={article.id}
              href={`/products/${article.id}`}
              className="flex items-center gap-3 rounded-tile border border-line bg-surface p-3"
            >
              <MediaImage
                src={article.image}
                alt=""
                sizes="52px"
                className={`size-[52px] shrink-0 rounded-tile text-base font-bold ${THUMB_TINTS[i % THUMB_TINTS.length].bg} ${THUMB_TINTS[i % THUMB_TINTS.length].text}`}
                fallback={initials(article.name)}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[15px] font-bold text-ink">{article.name}</span>
                <span className="text-[13px] text-subtle">
                  {article.type === 'simple'
                    ? t('products.typeSimple')
                    : t('products.list.inStockCount', { quantity: article.remaining_quantity }) +
                      t('products.list.variationsCount', { count: article.variations?.length ?? 0 })}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-sm font-bold text-ink">{priceRangeLabel(article, language)}</span>
                {isLowStock(article) ? (
                  <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning">
                    {article.type === 'simple'
                      ? t('products.list.remainingBadge', { quantity: article.remaining_quantity })
                      : t('products.list.statusLowStock')}
                  </span>
                ) : article.type === 'simple' ? (
                  <span className="text-xs font-semibold text-subtle">
                    {t('products.list.inStockCount', { quantity: article.remaining_quantity })}
                  </span>
                ) : null}
              </span>
            </Link>
          ))
        )}
      </div>

      {/* --- Carte ordinateur : filtres + recherche + tableau --- */}
      <Card className="hidden flex-col gap-3.5 rounded-panel p-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            value={filter}
            onChange={(v) => setFilter(v as FilterValue)}
            options={[
              { value: 'all', label: t('products.list.filterAll') },
              { value: 'low', label: t('products.list.filterLowStock', { count: lowStockCount }) },
              { value: 'variable', label: t('products.list.filterVariable') },
              { value: 'simple', label: t('products.list.filterSimple') },
            ]}
          />
          <div className="relative flex">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 size-[18px] text-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('products.list.searchPlaceholder')}
              className="h-11 w-[280px] max-w-full rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                {canEditStock ? (
                  <th className="w-10 px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          pageIds.forEach((id) => (allPageSelected ? next.delete(id) : next.add(id)))
                          return next
                        })
                      }
                      aria-label={t('products.list.selectPageAria')}
                      className="size-[18px] accent-[var(--color-brand-500)]"
                    />
                  </th>
                ) : null}
                <th className="px-2 py-2.5">{t('products.list.colArticle')}</th>
                <th className="px-2 py-2.5">{t('products.type')}</th>
                <th className="px-2 py-2.5">{t('products.list.colSalePrice')}</th>
                <th className="px-2 py-2.5">{t('products.colQuantity')}</th>
                <th className="px-2 py-2.5">{t('products.colStatus')}</th>
                <th className="px-2 py-2.5 text-right">{t('products.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedArticles.length === 0 ? (
                <tr>
                  <td colSpan={canEditStock ? 7 : 6} className="py-10 text-center text-sm text-subtle">
                    {t('products.list.noArticleFound')}
                  </td>
                </tr>
              ) : (
                paginatedArticles.map((article, i) => {
                  const total = article.sold_quantity + article.remaining_quantity
                  const barPercent = total > 0 ? Math.min(100, Math.round((article.remaining_quantity / total) * 100)) : 0
                  const lowStock = isLowStock(article)
                  return (
                    <tr key={article.id} className="border-t border-divider">
                      {canEditStock ? (
                        <td className="px-2 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(String(article.id))}
                            onChange={() => toggleSelected(String(article.id))}
                            aria-label={t('products.list.selectArticleAria', { name: article.name })}
                            className="size-[18px] accent-[var(--color-brand-500)]"
                          />
                        </td>
                      ) : null}
                      <td className="px-2 py-2.5">
                        <Link href={`/products/${article.id}`} className="flex items-center gap-3 text-ink">
                          <MediaImage
                            src={article.image}
                            alt=""
                            sizes="44px"
                            className={`size-11 shrink-0 rounded-tile text-sm font-extrabold ${THUMB_TINTS[i % THUMB_TINTS.length].bg} ${THUMB_TINTS[i % THUMB_TINTS.length].text}`}
                            fallback={initials(article.name)}
                          />
                          <span className="font-bold">{article.name}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-ink-2">
                        {article.type === 'simple'
                          ? t('products.typeSimple')
                          : t('products.list.typeVariableCount', { count: article.variations?.length ?? 0 })}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-bold text-ink">
                        {priceRangeLabel(article, language)}
                      </td>
                      <td className="min-w-[150px] px-2 py-2.5">
                        <span className="flex flex-col gap-1.5">
                          <span className="font-semibold text-ink">
                            {t('products.list.inStockCount', { quantity: article.remaining_quantity })}
                            {article.type === 'variable'
                              ? t('products.list.variationsCount', { count: article.variations?.length ?? 0 })
                              : ''}
                          </span>
                          <span className="block h-[5px] rounded-full bg-divider">
                            <span
                              className={`block h-full rounded-full ${lowStock ? 'bg-danger-dot' : 'bg-brand-500'}`}
                              style={{ width: `${barPercent}%` }}
                            />
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
                            lowStock ? 'bg-danger-bg text-danger-strong' : 'bg-success-bg text-success-strong'
                          }`}
                        >
                          {lowStock ? t('products.list.statusLowStock') : t('products.list.statusAvailable')}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <Link
                          href={`/products/${article.id}`}
                          className="inline-flex min-h-10 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-ink"
                        >
                          {t('products.detail.restock')}
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredArticles.length > 0 ? (
          <div className="flex items-center justify-between text-[13px] text-subtle">
            <span>
              {t('products.list.shownOfTotal', { shown: paginatedArticles.length, total: filteredArticles.length })}
            </span>
            <span className="flex gap-1.5">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`flex min-h-10 min-w-10 items-center justify-center rounded-full text-sm font-bold ${
                    p === page ? 'bg-active text-white' : 'border border-line-strong bg-surface text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
            </span>
          </div>
        ) : null}
      </Card>

      {/* --- Pagination mobile (compacte) --- */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex-1"
          >
            {t('products.previous')}
          </Button>
          <span className="text-sm font-semibold text-ink-2">
            {page} / {pageCount}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page === pageCount}
            className="flex-1"
          >
            {t('products.next')}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      <BarcodeScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        mode="once"
        title={t('barcode.stock.addByBarcode')}
        onDetected={(code) => void openFromBarcode(code)}
      />
      <GenerateMissingDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        scope={selected.size > 0 ? { articleIds: [...selected] } : undefined}
        onGenerated={() => {
          setSelected(new Set())
          void invalidateArticles()
        }}
      />
    </div>
  )
}
