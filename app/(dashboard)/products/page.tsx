'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Download, Plus, Search } from 'lucide-react'

import { useUserStats, useArticles } from '@/lib/hooks/useArticles'
import { exportToExcel, formatProductsForExport } from '@/lib/utils/export'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, Card, FilterChips } from '@/components/waelly'

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

  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<FilterValue>('all')
  const [page, setPage] = React.useState(1)

  const isLoading = isLoadingStats || isLoadingArticles
  const error = statsError || articlesError

  const lowStockCount = articles.filter((a) => isLowStock(a)).length

  const filteredArticles = React.useMemo(() => {
    return articles.filter((article) => {
      const matchesSearch = article.name.toLowerCase().includes(search.trim().toLowerCase())
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

  const handleExport = () => {
    exportToExcel(formatProductsForExport(articles, currency), 'stock-waelly', 'Stock')
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
        <Link
          href="/products/new"
          aria-label={t('products.list.addArticle')}
          className="flex size-12 items-center justify-center rounded-full bg-orb text-white shadow-button"
        >
          <Plus className="size-6" strokeWidth={2} />
        </Link>
      </div>

      {/* --- En-tête ordinateur --- */}
      <div className="hidden flex-wrap items-center justify-between gap-3.5 lg:flex">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('products.list.title')}</h1>
          <span className="text-sm text-subtle">{t('products.list.subtitleDesktop')}</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" onClick={handleExport}>
            <Download className="size-[18px]" />
            {t('products.list.exportExcel')}
          </Button>
          <Button variant="primary" asChild>
            <Link href="/products/new">
              <Plus className="size-[18px]" strokeWidth={2.2} />
              {t('products.list.addArticle')}
            </Link>
          </Button>
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
              <span
                className={`flex size-[52px] shrink-0 items-center justify-center rounded-tile text-base font-bold ${THUMB_TINTS[i % THUMB_TINTS.length].bg} ${THUMB_TINTS[i % THUMB_TINTS.length].text}`}
              >
                {initials(article.name)}
              </span>
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
                  <td colSpan={6} className="py-10 text-center text-sm text-subtle">
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
                      <td className="px-2 py-2.5">
                        <Link href={`/products/${article.id}`} className="flex items-center gap-3 text-ink">
                          <span
                            className={`flex size-11 shrink-0 items-center justify-center rounded-tile text-sm font-extrabold ${THUMB_TINTS[i % THUMB_TINTS.length].bg} ${THUMB_TINTS[i % THUMB_TINTS.length].text}`}
                          >
                            {initials(article.name)}
                          </span>
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
    </div>
  )
}
