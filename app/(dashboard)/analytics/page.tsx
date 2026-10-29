'use client'

import * as React from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { keepPreviousData } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Calendar } from 'lucide-react'

import { getErrorStatus, isSilentError } from '@/lib/utils/error-handler'
import { keys } from '@/lib/query-keys'
import {
  getCategoryAnalysis,
  getComparisons,
  getKPIs,
  getAnalyticsTransactions,
  getAnalyticsSummary,
  toSummaryPeriod,
  type AnalyticsParams,
  type AnalyticsTransaction,
} from '@/lib/services/analytics'
import { PaymentMethodsSection } from '@/components/waelly/payment-methods-section'
import { AffluenceHeatmap } from '@/components/waelly/affluence-heatmap'
import { TopVariationsSection } from '@/components/waelly/top-variations-section'
import { MemberSalesSection } from '@/components/waelly/member-sales-section'
import { TreasurySection } from '@/components/waelly/treasury-section'
import { Amount } from '@/components/waelly/amount'
import { computeKpiDelta } from '@/lib/analytics/kpi-delta'
import { Button, Card, CardTitle, KpiCard, SegmentedControl, FilterChips } from '@/components/waelly'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate, formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

const AreaTrendChart = dynamic(
  () => import('@/components/waelly/area-trend-chart').then((m) => m.AreaTrendChart),
  { ssr: false }
)
const CategoryDonut = dynamic(
  () => import('@/components/waelly/category-donut').then((m) => m.CategoryDonut),
  { ssr: false }
)

/**
 * Analyses — design/maquettes/ordinateur/Web-Analyses.dc.html (≥ 1024px) et
 * design/maquettes/mobile/Analyses.dc.html (< 768px).
 *
 * Écarts assumés par rapport à la maquette (API réelle n'offrant pas
 * exactement ce qu'elle suppose) :
 * - « Répartition des ventes » : la maquette suppose une catégorie d'article
 *   qui n'existe pas en base (aucune colonne category sur Article). L'anneau
 *   regroupe donc par ARTICLE (top 3 par montant + « Autres »), à partir de
 *   `category-analysis.top_products` — qui ne renvoie que le top 5 par
 *   QUANTITÉ côté backend, donc un article à forte valeur mais faible
 *   quantité peut se retrouver dans « Autres » plutôt qu'affiché nommément.
 * - « Tendance des ventes » : ajout d'une seconde courbe (dépenses, rouge)
 *   en parallèle de la courbe des ventes — extension demandée au-delà de la
 *   maquette d'origine, construite à partir du même jeu de transactions déjà
 *   chargé pour le tableau du bas.
 * - « Prévision » (ordinateur) : `getPredictions()` est un endpoint de
 *   réapprovisionnement par article (stock), pas une prévision de chiffre
 *   d'affaires. Conformément à la consigne, la carte affiche donc une
 *   estimation par régression linéaire sur les 6 derniers mois de ventes,
 *   explicitement présentée comme telle.
 * - Les 6 identifiants de période de la maquette (today/7/30/90/365/custom)
 *   sont traduits vers ceux réellement acceptés par le backend
 *   (today/7/30/custom) : "3 mois" et "12 mois" sont envoyés en `period:
 *   'custom'` avec les dates calculées, ce qui permet en prime un calcul de
 *   la période précédente sur une fenêtre glissante exacte.
 * - Le graphique de tendance réutilise le jeu de transactions déjà chargé
 *   pour le tableau du bas (plutôt que /analytics/trends) : le regroupement
 *   hebdomadaire/mensuel exigé par la maquette a besoin de dates exactes et
 *   parsables, alors que le regroupement auto de /trends encode certaines
 *   périodes (semaines) dans une clé non réutilisable côté client.
 * - Le lien « Tout voir dans le Portefeuille » transmet period/type dans
 *   l'URL comme demandé, mais /wallet ne lit pas encore ces paramètres.
 */

type PeriodId = 'today' | '7' | '30' | '90' | '365' | 'custom'

const PERIOD_ORDER: PeriodId[] = ['today', '7', '30', '90', '365', 'custom']
/** Clés des objets `analytics.page.period`/`comparisonSuffix`/`comparisonText` ("7"/"90"/"365" ne sont pas des identifiants JS valides en clé pointée). */
const PERIOD_KEY: Record<PeriodId, string> = {
  today: 'today',
  '7': 'd7',
  '30': 'd30',
  '90': 'd90',
  '365': 'd365',
  custom: 'custom',
}

function periodLabels(t: (key: string) => string): Record<PeriodId, string> {
  return {
    today: t('analytics.page.period.today'),
    '7': t('analytics.page.period.d7'),
    '30': t('analytics.page.period.d30'),
    '90': t('analytics.page.period.d90'),
    '365': t('analytics.page.period.d365'),
    custom: t('analytics.page.period.custom'),
  }
}

function comparisonSuffix(t: (key: string) => string, periodId: PeriodId): string {
  return t(`analytics.page.comparisonSuffix.${PERIOD_KEY[periodId]}`)
}

function comparisonText(t: (key: string) => string, periodId: PeriodId): string {
  return t(`analytics.page.comparisonText.${PERIOD_KEY[periodId]}`)
}

const Y_STEPS = [100_000, 300_000, 600_000, 2_000_000, 3_000_000]
const DONUT_COLORS = ['#2A1A9E', '#6A4CF0', '#A58CFF', '#DCD4FF']

function snapYMax(max: number): number {
  if (max <= 0) return Y_STEPS[0]
  return Y_STEPS.find((v) => v >= max) ?? max
}

const fmt = (n: number, language: AppLanguage) => formatNumber(Math.round(n), language, { maximumFractionDigits: 0 })
const pctFmt = (n: number, language: AppLanguage) => formatNumber(Math.abs(n), language, { maximumFractionDigits: 1 })

function short(n: number, language: AppLanguage): string {
  const decimalSeparator = language === 'en' ? '.' : ','
  if (Math.abs(n) >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toFixed(1).replace('.', decimalSeparator)} M`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}

/** Reprend design/maquettes/*.dc.html : plage de dates exacte par identifiant de période. */
function computeRange(periodId: PeriodId, now: Dayjs, customFrom: string, customTo: string): { start: Dayjs; end: Dayjs } {
  const end = now.endOf('day')
  switch (periodId) {
    case 'today':
      return { start: now.startOf('day'), end }
    case '7':
      return { start: now.subtract(6, 'day').startOf('day'), end }
    case '30':
      return { start: now.subtract(29, 'day').startOf('day'), end }
    case '90':
      return { start: now.subtract(89, 'day').startOf('day'), end }
    case '365':
      return { start: now.subtract(364, 'day').startOf('day'), end }
    case 'custom': {
      const from = dayjs(customFrom)
      const to = dayjs(customTo)
      return {
        start: (from.isValid() ? from : now.subtract(29, 'day')).startOf('day'),
        end: (to.isValid() ? to : now).endOf('day'),
      }
    }
  }
}

/** Même algorithme que AnalyticsController::comparisons() côté backend (période précédente de même durée). */
function previousRange(start: Dayjs, end: Dayjs): { start: Dayjs; end: Dayjs } {
  const daysDiff = end.startOf('day').diff(start.startOf('day'), 'day')
  const prevEnd = start.subtract(1, 'day').endOf('day')
  const prevStart = prevEnd.subtract(daysDiff, 'day').startOf('day')
  return { start: prevStart, end: prevEnd }
}

function toApiParams(periodId: PeriodId, start: Dayjs, end: Dayjs): AnalyticsParams {
  if (periodId === 'today' || periodId === '7' || periodId === '30') {
    return { period: periodId }
  }
  return { period: 'custom', start_date: start.format('YYYY-MM-DD'), end_date: end.format('YYYY-MM-DD') }
}

function formatRangeText(periodId: PeriodId, start: Dayjs, end: Dayjs, language: AppLanguage): string {
  if (periodId === 'today') {
    return capitalize(formatDate(start.toDate(), language, 'dddd D MMMM YYYY'))
  }
  if (periodId === '365') {
    const text = `${formatDate(start.toDate(), language, 'MMM YYYY')} → ${formatDate(end.toDate(), language, 'MMM').toLowerCase()} ${end.year()}`
    return capitalize(text)
  }
  const sameMonth = start.month() === end.month() && start.year() === end.year()
  const startPart = sameMonth ? `${start.date()}` : `${start.date()} ${formatDate(start.toDate(), language, 'MMM').toLowerCase()}`
  return capitalize(`${startPart} → ${end.date()} ${formatDate(end.toDate(), language, 'MMM').toLowerCase()} ${end.year()}`)
}

type TrendPoint = { label: string; value: number }

/** Regroupe les transactions de vente brutes en points de tendance, selon les règles exactes de la maquette par période (jamais 30 points journaliers en dents de scie). */
function buildTrendPoints(
  periodId: PeriodId,
  sales: AnalyticsTransaction[],
  start: Dayjs,
  end: Dayjs,
  compact: boolean,
  language: AppLanguage,
  t: (key: string, params?: Record<string, string | number>) => string
): TrendPoint[] {
  const sorted = [...sales].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf())

  if (periodId === 'today') {
    const checkpoints = [8, 10, 12, 14, 16, 18]
    let running = 0
    let cursor = 0
    const hourSuffix = language === 'en' ? ':00' : 'h'
    return checkpoints.map((h) => {
      const boundary = start.hour(h).minute(0).second(0)
      while (cursor < sorted.length && dayjs(sorted[cursor].created_at).valueOf() <= boundary.valueOf()) {
        running += Number(sorted[cursor].amount)
        cursor += 1
      }
      return { label: `${h}${hourSuffix}`, value: running }
    })
  }

  const daysSpan = end.startOf('day').diff(start.startOf('day'), 'day') + 1

  if (periodId === '7' || (periodId === 'custom' && daysSpan <= 14)) {
    const byDay = new Map<string, number>()
    let d = start.startOf('day')
    while (d.valueOf() <= end.valueOf()) {
      byDay.set(d.format('YYYY-MM-DD'), 0)
      d = d.add(1, 'day')
    }
    sorted.forEach((tx) => {
      const key = dayjs(tx.created_at).format('YYYY-MM-DD')
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + Number(tx.amount))
    })
    return Array.from(byDay.entries()).map(([key, value]) => ({
      label: formatDate(dayjs(key).toDate(), language, 'ddd'),
      value,
    }))
  }

  if (periodId === '90' || periodId === '365' || (periodId === 'custom' && daysSpan > 90)) {
    const byMonth = new Map<string, number>()
    let d = start.startOf('month')
    const last = end.startOf('month')
    while (d.valueOf() <= last.valueOf()) {
      byMonth.set(d.format('YYYY-MM'), 0)
      d = d.add(1, 'month')
    }
    sorted.forEach((tx) => {
      const key = dayjs(tx.created_at).format('YYYY-MM')
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(tx.amount))
    })
    const entries = Array.from(byMonth.entries()).slice(-12)
    return entries.map(([key, value]) => {
      const m = dayjs(key, 'YYYY-MM')
      const monthShort = formatDate(m.toDate(), language, 'MMM')
      const label = compact ? monthShort[0].toUpperCase() : monthShort
      return { label, value }
    })
  }

  // '30 jours' (ou "custom" 15-90 jours) : ~5 points hebdomadaires, jamais 30 points journaliers.
  const bucketCount = Math.min(5, Math.max(1, Math.ceil(daysSpan / 7)))
  const bucketDays = Math.ceil(daysSpan / bucketCount)
  const buckets = Array.from({ length: bucketCount }, () => 0)
  sorted.forEach((tx) => {
    const offset = dayjs(tx.created_at).startOf('day').diff(start.startOf('day'), 'day')
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(offset / bucketDays)))
    buckets[idx] += Number(tx.amount)
  })
  return buckets.map((value, i) => ({
    label: compact ? `${t('analytics.page.compactWeekPrefix')}${i + 1}` : t('analytics.page.weekLabel', { n: i + 1 }),
    value,
  }))
}

/** Régression linéaire simple (y = a + bx) sur les totaux mensuels, pour une estimation du mois suivant — clairement présentée comme une estimation. */
function linearForecast(monthlyTotals: number[]): number {
  const n = monthlyTotals.length
  if (n < 2) return monthlyTotals[0] ?? 0
  const xs = monthlyTotals.map((_, i) => i)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = monthlyTotals.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - meanX) * (monthlyTotals[i] - meanY)
    den += (x - meanX) ** 2
  })
  const b = den === 0 ? 0 : num / den
  const a = meanY - b * meanX
  return Math.max(0, a + b * n)
}

/** Récupère TOUTES les transactions correspondant aux paramètres (boucle sur la pagination serveur), pour des sommes/regroupements client-side exacts plutôt qu'une seule page. */
async function fetchAllTransactions(params: AnalyticsParams): Promise<AnalyticsTransaction[]> {
  const perPage = 100
  const maxPages = 30
  let page = 1
  let acc: AnalyticsTransaction[] = []
  for (;;) {
    const res = await getAnalyticsTransactions({ ...params, per_page: perPage, page })
    acc = acc.concat(res.transactions)
    if (page >= res.pagination.last_page || page >= maxPages) break
    page += 1
  }
  return acc
}

function formatTxMeta(
  dateString: string,
  withType: boolean,
  type: 'sale' | 'expense',
  language: AppLanguage,
  t: (key: string) => string
): string {
  const d = dayjs(dateString)
  const today = dayjs().startOf('day')
  const dayPart = d.isSame(today, 'day')
    ? t('wallet.today')
    : d.isSame(today.subtract(1, 'day'), 'day')
      ? t('wallet.yesterday')
      : `${d.date()} ${formatDate(d.toDate(), language, 'MMM').toLowerCase()}`
  const base = `${dayPart} · ${d.format('HH:mm')}`
  return withType ? `${base} · ${type === 'sale' ? t('transactions.sale') : t('transactions.expense')}` : base
}

function buildTypeOptions(t: (key: string) => string) {
  return [
    { value: 'all', label: t('analytics.page.typeAll') },
    { value: 'sale', label: t('transactions.sales') },
    { value: 'expense', label: t('transactions.expenses') },
  ]
}

const KPI_COLOR = { positive: '#0B8A43', negative: '#D92D20' }

function kpiDeltaPct(change: number | undefined, goodWhenIncreasing: boolean, language: AppLanguage, suffix?: string) {
  if (change === undefined || Number.isNaN(change)) return undefined
  const trend: 'up' | 'down' = change >= 0 ? 'up' : 'down'
  const positive = goodWhenIncreasing ? trend === 'up' : trend === 'down'
  const arrow = trend === 'up' ? '↑' : '↓'
  const text = `${arrow} ${pctFmt(change, language)} %${suffix ? ` ${suffix}` : ''}`
  return { text, trend, positive }
}

export default function AnalyticsPage() {
  const { t, language } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()

  const urlPeriod = (searchParams.get('period') as PeriodId) || '30'
  const periodId: PeriodId = PERIOD_ORDER.includes(urlPeriod) ? urlPeriod : '30'
  const customFrom = searchParams.get('from') || ''
  const customTo = searchParams.get('to') || ''
  const txType = (searchParams.get('type') as 'all' | 'sale' | 'expense') || 'all'
  const [showAllTx, setShowAllTx] = React.useState(false)
  const [draftFrom, setDraftFrom] = React.useState(customFrom)
  const [draftTo, setDraftTo] = React.useState(customTo)

  // Les calculs de date dépendent de l'horloge au moment du rendu : calculé
  // uniquement après le montage pour éviter une erreur d'hydratation (le
  // serveur et le client peuvent différer d'une fraction de seconde, voire
  // d'un jour pile à minuit).
  const [now, setNow] = React.useState<Dayjs | null>(null)
  React.useEffect(() => {
    setNow(dayjs())
  }, [])

  const updateUrl = React.useCallback(
    (next: { period?: PeriodId; from?: string; to?: string; type?: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.period) params.set('period', next.period)
      if (next.period && next.period !== 'custom') {
        params.delete('from')
        params.delete('to')
      }
      if (next.from !== undefined) params.set('from', next.from)
      if (next.to !== undefined) params.set('to', next.to)
      if (next.type) {
        if (next.type === 'all') params.delete('type')
        else params.set('type', next.type)
      }
      router.replace(`/analytics?${params.toString()}`, { scroll: false })
      setShowAllTx(false)
    },
    [router, searchParams, setShowAllTx]
  )

  const handlePeriodChange = (id: string) => {
    const pid = id as PeriodId
    if (pid === 'custom') {
      setDraftFrom(customFrom || dayjs().subtract(29, 'day').format('YYYY-MM-DD'))
      setDraftTo(customTo || dayjs().format('YYYY-MM-DD'))
    }
    updateUrl({ period: pid })
  }

  const applyCustomRange = () => {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return
    updateUrl({ period: 'custom', from: draftFrom, to: draftTo })
  }

  const { start, end } = now
    ? computeRange(periodId, now, customFrom, customTo)
    : { start: dayjs(), end: dayjs() }
  const { start: prevStart, end: prevEnd } = previousRange(start, end)
  const apiParams = toApiParams(periodId, start, end)
  const prevApiParams: AnalyticsParams = {
    period: 'custom',
    start_date: prevStart.format('YYYY-MM-DD'),
    end_date: prevEnd.format('YYYY-MM-DD'),
  }
  const rangeText = formatRangeText(periodId, start, end, language)
  const queryKeyParams = JSON.stringify(apiParams)
  const enabled = now !== null

  // Analytics suit le même rythme que le Dashboard (données chiffre
  // d'affaires/tendances) : 1 min, pas le défaut 5 min "stock/factures".
  const ANALYTICS_STALE_TIME = 60 * 1000

  const { data: kpis, isLoading: loadingKpis, error: kpisError } = useQuery({
    queryKey: keys.analytics.kpis(queryKeyParams),
    queryFn: () => getKPIs(apiParams),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

  const { data: prevKpis } = useQuery({
    queryKey: keys.analytics.kpis(`${queryKeyParams}:prev`),
    queryFn: () => getKPIs(prevApiParams),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

  const { data: comparisons, isLoading: loadingComparisons, error: comparisonsError } = useQuery({
    queryKey: keys.analytics.comparisons(queryKeyParams),
    queryFn: () => getComparisons(apiParams),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

  // Chantier "stats-paiements" : un seul résumé pour les sections
  // "Encaissements par moyen de paiement" / heatmap / top variations /
  // trésorerie — voir AnalyticsSummaryService (backend) pour pourquoi un
  // seul endpoint plutôt que plusieurs.
  const summaryPeriod = toSummaryPeriod(periodId)
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: keys.analytics.summary(`${summaryPeriod}:${customFrom}:${customTo}`),
    queryFn: () => getAnalyticsSummary(summaryPeriod, customFrom || undefined, customTo || undefined),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

  const { data: categoryAnalysis, isLoading: loadingCategory, error: categoryError } = useQuery({
    queryKey: keys.analytics.category(queryKeyParams),
    queryFn: () => getCategoryAnalysis(apiParams),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

  // Jeu complet des transactions de la période (toutes, non filtrées par
  // type) : sert à la fois au tableau du bas et, pour les ventes, au
  // regroupement du graphique de tendance — une seule source de vérité,
  // comme le fait le script de la maquette (filtre/tranche uniquement côté
  // affichage).
  const {
    data: allTransactions,
    isLoading: loadingTransactions,
    error: transactionsError,
  } = useQuery({
    queryKey: keys.analytics.transactions(queryKeyParams),
    queryFn: () => fetchAllTransactions(apiParams),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

  // 6 derniers mois de ventes (indépendant de la période choisie) pour
  // l'estimation par régression linéaire de la carte « Prévision ».
  const { data: forecastTransactions } = useQuery({
    queryKey: keys.analytics.forecast(),
    queryFn: () => {
      if (!now) return Promise.resolve([])
      const fcStart = now.subtract(5, 'month').startOf('month')
      return fetchAllTransactions({
        period: 'custom',
        start_date: fcStart.format('YYYY-MM-DD'),
        end_date: now.format('YYYY-MM-DD'),
        type: 'sale',
      })
    },
    enabled,
  })

  const queries = [kpisError, comparisonsError, categoryError, transactionsError]
  const authError = queries.find((e) => e && getErrorStatus(e) === 401)
  const otherError = queries.find((e) => e && !isSilentError(e) && getErrorStatus(e) !== 401)
  const isLoading = !enabled || loadingKpis || loadingComparisons || loadingCategory || loadingTransactions

  const salesInPeriod = React.useMemo(
    () => (allTransactions ?? []).filter((tx) => tx.type === 'sale'),
    [allTransactions]
  )
  const expensesInPeriod = React.useMemo(
    () => (allTransactions ?? []).filter((tx) => tx.type === 'expense'),
    [allTransactions]
  )
  const trendData = enabled ? buildTrendPoints(periodId, salesInPeriod, start, end, false, language, t) : []
  const trendDataMobile = enabled ? buildTrendPoints(periodId, salesInPeriod, start, end, true, language, t) : []
  const expenseTrendData = enabled ? buildTrendPoints(periodId, expensesInPeriod, start, end, false, language, t) : []
  const expenseTrendDataMobile = enabled ? buildTrendPoints(periodId, expensesInPeriod, start, end, true, language, t) : []
  const trendMax = Math.max(0, ...trendData.map((p) => p.value), ...expenseTrendData.map((p) => p.value))
  const yMax = snapYMax(trendMax)

  // Répartition des ventes par article (écart assumé : l'API ne retourne que
  // le top 5 par quantité — cf. note en tête de fichier — donc un article à
  // forte valeur mais faible quantité peut finir dans « Autres »).
  const donutData = React.useMemo(() => {
    const totalSales = summary?.kpis.revenue.value ?? 0
    const topProducts = [...(categoryAnalysis?.top_products ?? [])].sort((a, b) => b.total_amount - a.total_amount)
    if (totalSales <= 0 || topProducts.length === 0) return []
    const top3 = topProducts.slice(0, 3)
    const slices: { label: string; value: number; color: string; ringColor?: string }[] = top3.map((p, i) => ({
      label: p.name,
      value: Math.round((p.total_amount / totalSales) * 100),
      color: DONUT_COLORS[i],
    }))
    const othersPercent = Math.max(0, 100 - top3.reduce((sum, p) => sum + (p.total_amount / totalSales) * 100, 0))
    if (othersPercent >= 1) {
      slices.push({ label: t('analytics.page.others'), value: Math.round(othersPercent), color: DONUT_COLORS[3] })
    }
    if (slices.length > 1) slices[slices.length - 1].ringColor = '#B9ACF5'
    return slices
  }, [categoryAnalysis, summary, t])

  const bestArticles = (categoryAnalysis?.top_products ?? []).slice(0, 4)

  const forecastNextMonth = React.useMemo(() => {
    if (!forecastTransactions || !now) return 0
    const byMonth = new Map<string, number>()
    let d = now.subtract(5, 'month').startOf('month')
    for (let i = 0; i < 6; i++) {
      byMonth.set(d.format('YYYY-MM'), 0)
      d = d.add(1, 'month')
    }
    forecastTransactions.forEach((tx) => {
      const key = dayjs(tx.created_at).format('YYYY-MM')
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(tx.amount))
    })
    return linearForecast(Array.from(byMonth.values()))
  }, [forecastTransactions, now])

  const nextMonthLabel = now ? capitalize(formatDate(now.add(1, 'month').toDate(), language, 'MMMM YYYY')) : ''

  // Chantier "stats-paiements" / fix/analytics-zero — LES 7 CARTES KPI
  // viennent maintenant du MÊME endpoint (summary.kpis), avec la MÊME
  // période : plus de double source pour "Chiffre d'affaires" (ancien
  // `overview` vs nouveau `summary`), qui pouvait sembler incohérente.
  //
  // `goodWhenIncreasing` varie par indicateur : une baisse des Dépenses est
  // une bonne nouvelle (vert), une baisse du CA est une mauvaise nouvelle
  // (rouge) — voir computeKpiDelta(). Montants via <Amount> (masquables) ;
  // nombre de ventes/articles vendus/articles-par-panier sont des COMPTES,
  // jamais wrappés dans <Amount>.
  const deltaLabels = { flat: '—', new: t('common.new') }
  const formatPct = (n: number) => pctFmt(n, language)

  function kpiRow(
    label: string,
    value: React.ReactNode,
    metric: { value: number; previous: number; change_percent: number } | undefined,
    goodWhenIncreasing: boolean,
    suffix?: string
  ) {
    const delta = metric ? computeKpiDelta(metric.value, metric.previous, metric.change_percent, goodWhenIncreasing, formatPct, deltaLabels, suffix) : undefined
    return { label, value, delta: delta?.text, trend: delta?.trend ?? 'up', positive: delta?.positive ?? true, showArrow: delta?.showArrow ?? false, hero: false }
  }

  const summaryKpiCards = [
    {
      ...kpiRow(t('analytics.page.kpiRevenue'), summary ? <><Amount value={summary.kpis.revenue.value} /> F</> : '—', summary?.kpis.revenue, true, comparisonSuffix(t, periodId)),
      hero: true,
    },
    kpiRow(t('transactions.expenses'), summary ? <><Amount value={summary.kpis.expenses.value} /> F</> : '—', summary?.kpis.expenses, false),
    kpiRow(t('analytics.page.kpiNetProfit'), summary ? <><Amount value={summary.kpis.net_profit.value} /> F</> : '—', summary?.kpis.net_profit, true),
    kpiRow(t('analytics.page.salesCountLabel'), summary ? formatNumber(summary.kpis.sales_count.value, language, { maximumFractionDigits: 0 }) : '—', summary?.kpis.sales_count, true),
    kpiRow(t('analytics.averageBasket'), summary ? <><Amount value={summary.kpis.average_basket.value} /> F</> : '—', summary?.kpis.average_basket, true),
    kpiRow(t('analytics.page.itemsPerBasketLabel'), summary ? formatNumber(summary.kpis.items_per_basket.value, language, { maximumFractionDigits: 1 }) : '—', summary?.kpis.items_per_basket, true),
    kpiRow(t('analytics.page.itemsSoldLabel'), summary ? formatNumber(summary.kpis.items_sold.value, language, { maximumFractionDigits: 0 }) : '—', summary?.kpis.items_sold, true),
  ]

  const compareRows = comparisons
    ? [
        { label: t('analytics.page.kpiRevenue'), now: comparisons.sales.current, prev: comparisons.sales.previous, change: comparisons.sales.change, good: true },
        { label: t('transactions.expenses'), now: comparisons.expenses.current, prev: comparisons.expenses.previous, change: comparisons.expenses.change, good: false },
        {
          label: t('analytics.page.salesCountLabel'),
          now: kpis?.sales_count ?? 0,
          prev: prevKpis?.sales_count ?? 0,
          change: prevKpis && prevKpis.sales_count > 0 ? ((kpis?.sales_count ?? 0) - prevKpis.sales_count) / prevKpis.sales_count * 100 : 0,
          good: true,
        },
      ]
    : []

  const filteredTx = (allTransactions ?? []).filter((tx) => txType === 'all' || tx.type === txType)
  const sumIn = salesInPeriod.reduce((a, tx) => a + Number(tx.amount), 0)
  const sumOut = (allTransactions ?? []).filter((tx) => tx.type === 'expense').reduce((a, tx) => a + Number(tx.amount), 0)
  const txTotal = allTransactions?.length ?? 0

  const slicedDesktop = showAllTx ? filteredTx : filteredTx.slice(0, 6)
  const slicedMobile = showAllTx ? filteredTx : filteredTx.slice(0, 5)
  const hasMoreDesktop = filteredTx.length > 6
  const hasMoreMobile = filteredTx.length > 5

  const walletHref = `/wallet?period=${periodId}${txType !== 'all' ? `&type=${txType}` : ''}`

  if (authError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="size-12 text-subtle" />
        <p className="text-sm text-subtle">{t('analytics.page.redirectingToLogin')}</p>
      </div>
    )
  }

  if (otherError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-12 text-subtle" />
        <p className="text-sm text-subtle">
          {(otherError as Error).message || t('analytics.page.loadError')}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            queryClient.invalidateQueries({
              predicate: (query) => query.queryKey[0] === 'analytics',
            })
          }
        >
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  const periodLabelsByPeriod = periodLabels(t)
  const periodChips = PERIOD_ORDER.map((id) => ({ value: id, label: periodLabelsByPeriod[id] }))
  const typeOptions = buildTypeOptions(t)

  const customDatesDesktop = (
    <div className="flex flex-wrap items-end gap-3 rounded-[20px] bg-surface p-3.5 shadow-card">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="adu" className="text-xs font-semibold text-subtle">{t('analytics.from')}</label>
        <input
          id="adu"
          type="date"
          value={draftFrom}
          onChange={(e) => setDraftFrom(e.target.value)}
          className="h-11 rounded-xl border border-line-strong px-3 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="aau" className="text-xs font-semibold text-subtle">{t('analytics.to')}</label>
        <input
          id="aau"
          type="date"
          value={draftTo}
          onChange={(e) => setDraftTo(e.target.value)}
          className="h-11 rounded-xl border border-line-strong px-3 text-sm text-ink"
        />
      </div>
      <button
        type="button"
        onClick={applyCustomRange}
        disabled={!draftFrom || !draftTo || draftFrom > draftTo}
        className="flex h-11 items-center rounded-full bg-active px-4.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {t('analytics.page.apply')}
      </button>
    </div>
  )

  const customDatesMobile = (
    <div className="grid grid-cols-2 gap-2.5 rounded-[18px] border border-line bg-surface p-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="du" className="text-xs font-semibold text-subtle">{t('analytics.from')}</label>
        <input
          id="du"
          type="date"
          value={draftFrom}
          onChange={(e) => {
            setDraftFrom(e.target.value)
            if (e.target.value && draftTo) updateUrl({ period: 'custom', from: e.target.value, to: draftTo })
          }}
          className="h-11 min-w-0 rounded-xl border border-line-strong bg-canvas px-2.5 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="au" className="text-xs font-semibold text-subtle">{t('analytics.to')}</label>
        <input
          id="au"
          type="date"
          value={draftTo}
          onChange={(e) => {
            setDraftTo(e.target.value)
            if (draftFrom && e.target.value) updateUrl({ period: 'custom', from: draftFrom, to: e.target.value })
          }}
          className="h-11 min-w-0 rounded-xl border border-line-strong bg-canvas px-2.5 text-sm text-ink"
        />
      </div>
    </div>
  )

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 1024px) ============================= */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('nav.analytics')}</h1>
            <span className="text-sm text-subtle">{rangeText}</span>
          </div>
          <SegmentedControl options={periodChips} value={periodId} onChange={handlePeriodChange} />
        </div>

        {periodId === 'custom' ? customDatesDesktop : null}

        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {loadingSummary
            ? [1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-[120px] animate-pulse rounded-card bg-surface-soft" />)
            : summaryKpiCards.map((k) =>
                k.hero ? (
                  <div
                    key={k.label}
                    className="flex flex-col gap-2 rounded-hero bg-hero p-5 text-white shadow-hero"
                  >
                    <span className="text-[13px] text-navy-text">{k.label}</span>
                    <span className="text-[28px] font-bold tracking-tight">{k.value}</span>
                    {k.delta ? <span className="text-[13px] font-bold" style={{ color: '#9FF0C4' }}>{k.delta}</span> : null}
                  </div>
                ) : (
                  <KpiCard
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    delta={k.delta}
                    trend={k.trend}
                    positive={k.positive}
                    showArrow={k.showArrow}
                  />
                )
              )}
        </div>

        <PaymentMethodsSection
          data={summary?.payment_methods}
          isLoading={loadingSummary}
          period={summaryPeriod}
          startDate={summary?.start_date ?? ''}
          endDate={summary?.end_date ?? ''}
        />

        <div className="flex flex-wrap gap-5">
          <Card className="flex-[2_1_560px]">
            {isLoading ? (
              <div className="h-[260px] animate-pulse rounded-tile bg-surface-soft" />
            ) : (
              <AreaTrendChart
                title={t('analytics.page.trendTitle')}
                trendPercent={comparisons ? Math.abs(comparisons.sales.change) : undefined}
                trendLabel={comparisonText(t, periodId)}
                data={trendData}
                secondarySeries={{ data: expenseTrendData, label: t('transactions.expenses') }}
                yMax={yMax}
                showTooltip
                height={240}
                actions={
                  <span className="rounded-2xl border border-line-strong px-3 py-2 text-[13px] font-semibold">
                    {periodLabelsByPeriod[periodId]}
                  </span>
                }
              />
            )}
          </Card>

          <Card className="flex-[1_1_300px]">
            <CardTitle>{t('analytics.page.distributionTitle')}</CardTitle>
            <div className="mt-4">
              {isLoading ? (
                <div className="h-[220px] animate-pulse rounded-tile bg-surface-soft" />
              ) : donutData.length > 0 ? (
                <CategoryDonut
                  data={donutData}
                  centerValue={short(summary?.kpis.revenue.value ?? 0, language)}
                  centerLabel={t('analytics.page.totalSalesLabel')}
                />
              ) : (
                <p className="py-10 text-center text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-wrap gap-5">
          <Card className="flex-[1_1_320px]">
            <CardTitle>{t('analytics.page.comparisonTitle')}</CardTitle>
            <div className="mt-3.5 flex flex-col gap-3.5">
              {compareRows.map((row) => {
                const maxVal = Math.max(row.now, row.prev, 1)
                const delta = kpiDeltaPct(row.change, row.good, language)
                return (
                  <div key={row.label} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-ink">{row.label}</span>
                      <span className="font-bold" style={{ color: delta?.positive ? KPI_COLOR.positive : KPI_COLOR.negative }}>
                        {delta?.text}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="block h-2 rounded bg-surface-soft">
                        <span className="block h-full rounded bg-brand-500" style={{ width: `${Math.min(100, (row.now / maxVal) * 100)}%` }} />
                      </span>
                      <span className="block h-2 rounded bg-surface-soft">
                        <span className="block h-full rounded bg-brand-200" style={{ width: `${Math.min(100, (row.prev / maxVal) * 100)}%` }} />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3.5 flex gap-4 text-xs text-ink-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-brand-500" />{t('analytics.page.currentPeriod')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-brand-200" />{t('analytics.page.previousPeriod')}</span>
            </div>
          </Card>

          <Card className="flex-[1_1_320px]">
            <CardTitle>{t('analytics.page.bestArticlesTitle')}</CardTitle>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {bestArticles.length === 0 ? (
                <p className="text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
              ) : (
                bestArticles.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="w-7 font-extrabold text-brand-500">{i + 1}</span>
                    <span className="flex-1 font-semibold text-ink">{a.name}</span>
                    <span className="text-ink-3">{t('analytics.page.salesCountIcu', { count: a.total_quantity })}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <section
            className="flex flex-[1_1_320px] flex-col gap-3 rounded-[26px] p-5.5 text-white"
            style={{
              background: 'radial-gradient(120% 140% at 100% 100%, #3A3AF0 0%, #1717A0 40%, #0A0A4A 85%)',
              boxShadow: '0 14px 30px rgba(16,16,120,0.24)',
            }}
          >
            <h2 className="text-lg font-bold">{t('analytics.page.forecastTitle')}</h2>
            <span className="text-[34px] font-extrabold tracking-tight">≈ {short(forecastNextMonth, language)} F</span>
            <p className="text-sm leading-relaxed" style={{ color: '#DCDCF7' }}>
              {t('analytics.page.forecastDescription', { month: nextMonthLabel })}
            </p>
          </section>
        </div>

        <AffluenceHeatmap cells={summary?.heatmap.cells ?? []} isLoading={loadingSummary} />

        <TopVariationsSection rows={summary?.top_variations ?? []} isLoading={loadingSummary} />

        <MemberSalesSection rows={summary?.by_member ?? []} isLoading={loadingSummary} />

        <TreasurySection treasury={summary?.treasury} isLoading={loadingSummary} />

        <section className="flex flex-col gap-3.5 rounded-[26px] bg-surface p-5.5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-ink">{t('analytics.page.transactionsTitle')}</h2>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">
                {t('analytics.page.operationsCountIcu', { count: txTotal })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-bold text-success-strong">{t('analytics.page.inflows')} +{fmt(sumIn, language)} F</span>
              <span className="text-[13px] font-bold text-danger-strong">{t('analytics.page.outflows')} −{fmt(sumOut, language)} F</span>
              <FilterChips
                options={typeOptions}
                value={txType}
                onChange={(v) => updateUrl({ type: v })}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />)}
            </div>
          ) : filteredTx.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">{t('analytics.page.noTransactionsInPeriod')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                    <th className="px-2 py-2.5">{t('analytics.page.colOperation')}</th>
                    <th className="px-2 py-2.5">{t('analytics.page.colType')}</th>
                    <th className="px-2 py-2.5">{t('analytics.page.colDate')}</th>
                    <th className="px-2 py-2.5 text-right">{t('analytics.page.colAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {slicedDesktop.map((tx) => (
                    <tr key={tx.id} className="border-t border-divider">
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${
                              tx.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                            }`}
                          >
                            {tx.type === 'sale' ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                          </span>
                          <span className="font-semibold text-ink">{tx.name}</span>
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            tx.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                          }`}
                        >
                          {tx.type === 'sale' ? t('transactions.sale') : t('transactions.expense')}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-ink-3">{formatTxMeta(tx.created_at, false, tx.type, language, t)}</td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-right font-bold ${
                          tx.type === 'sale' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {tx.type === 'sale' ? '+' : '−'}{fmt(Number(tx.amount), language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMoreDesktop ? (
            <button
              type="button"
              onClick={() => setShowAllTx((v) => !v)}
              className="self-center rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-bold"
              style={{ color: '#3A20B8' }}
            >
              {showAllTx ? t('analytics.page.collapse') : t('analytics.page.viewTransactionsCount', { count: filteredTx.length })}
            </button>
          ) : null}

          {txTotal > 50 ? (
            <Link href={walletHref} className="self-center text-sm font-semibold text-brand-600">
              {t('analytics.page.viewAllInWallet')}
            </Link>
          ) : null}
        </section>
      </div>

      {/* ============================= MOBILE (< 768px) ============================= */}
      <div className="flex flex-col gap-4.5 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('nav.analytics')}</h1>
            <span className="text-[13px] text-subtle">{rangeText}</span>
          </div>
          <button
            type="button"
            onClick={() => handlePeriodChange('custom')}
            aria-label={t('analytics.page.chooseDatesAria')}
            className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] font-semibold text-ink shadow-[0_2px_10px_rgba(17,17,80,0.06)]"
          >
            <Calendar className="size-[17px]" strokeWidth={1.9} />
            {t('analytics.page.datesButton')}
          </button>
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          {periodChips.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={p.value === periodId}
              onClick={() => handlePeriodChange(p.value)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-semibold ${
                p.value === periodId ? 'bg-active text-white' : 'border border-line-strong bg-surface text-ink-2'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodId === 'custom' ? customDatesMobile : null}

        <div className="grid grid-cols-2 gap-2.5">
          {loadingSummary
            ? [1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-tile bg-surface-soft" />)
            : summaryKpiCards.map((k) =>
                k.hero ? (
                  <div key={k.label} className="col-span-2 flex flex-col gap-2 rounded-hero bg-hero p-5 text-white shadow-hero">
                    <span className="text-[13px] text-navy-text">{k.label}</span>
                    <span className="text-[28px] font-bold tracking-tight">{k.value}</span>
                    {k.delta ? <span className="text-[13px] font-bold" style={{ color: '#9FF0C4' }}>{k.delta}</span> : null}
                  </div>
                ) : (
                  <KpiCard
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    delta={k.delta}
                    trend={k.trend}
                    positive={k.positive}
                    showArrow={k.showArrow}
                  />
                )
              )}
        </div>

        <PaymentMethodsSection
          data={summary?.payment_methods}
          isLoading={loadingSummary}
          period={summaryPeriod}
          startDate={summary?.start_date ?? ''}
          endDate={summary?.end_date ?? ''}
        />

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-ink">{t('analytics.page.trendTitle')}</span>
            <span className="rounded-2xl border border-line-strong px-3 py-2 text-[13px] font-semibold">
              {periodLabelsByPeriod[periodId]}
            </span>
          </div>
          {isLoading ? (
            <div className="mt-2.5 h-[180px] animate-pulse rounded-tile bg-surface-soft" />
          ) : (
            <AreaTrendChart
              trendPercent={comparisons ? Math.abs(comparisons.sales.change) : undefined}
              trendLabel={comparisonText(t, periodId)}
              data={trendDataMobile}
              secondarySeries={{ data: expenseTrendDataMobile, label: t('transactions.expenses') }}
              yMax={yMax}
              showTooltip
              height={180}
              className="mt-2.5"
            />
          )}
        </Card>

        <Card>
          <CardTitle>{t('analytics.page.distributionTitle')}</CardTitle>
          <div className="mt-3.5 flex items-center gap-4">
            {isLoading ? (
              <div className="h-[128px] w-[128px] shrink-0 animate-pulse rounded-full bg-surface-soft" />
            ) : donutData.length > 0 ? (
              <CategoryDonut
                data={donutData}
                centerValue={short(summary?.kpis.revenue.value ?? 0, language)}
                centerLabel={t('analytics.page.totalSalesLabel')}
                size={128}
                layout="row"
              />
            ) : (
              <p className="py-6 text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>{t('analytics.page.comparisonTitle')}</CardTitle>
          <div className="mt-3.5 flex flex-col gap-3.5">
            {compareRows.map((row) => {
              const maxVal = Math.max(row.now, row.prev, 1)
              const delta = kpiDeltaPct(row.change, row.good, language)
              return (
                <div key={row.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-ink">{row.label}</span>
                    <span className="font-bold" style={{ color: delta?.positive ? KPI_COLOR.positive : KPI_COLOR.negative }}>
                      {delta?.text}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="block h-2 rounded bg-surface-soft">
                      <span className="block h-full rounded bg-brand-500" style={{ width: `${Math.min(100, (row.now / maxVal) * 100)}%` }} />
                    </span>
                    <span className="block h-2 rounded bg-surface-soft">
                      <span className="block h-full rounded bg-brand-200" style={{ width: `${Math.min(100, (row.prev / maxVal) * 100)}%` }} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3.5 flex gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-brand-500" />{t('analytics.page.currentPeriod')}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-brand-200" />{t('analytics.page.previousPeriod')}</span>
          </div>
        </Card>

        <Card>
          <CardTitle>{t('analytics.page.bestArticlesTitle')}</CardTitle>
          <div className="mt-2.5 flex flex-col gap-2.5">
            {bestArticles.length === 0 ? (
              <p className="text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
            ) : (
              bestArticles.map((a, i) => (
                <div key={a.id} className="flex items-center gap-3 text-sm">
                  <span className="w-7 font-extrabold text-brand-500">{i + 1}</span>
                  <span className="flex-1 font-semibold text-ink">{a.name}</span>
                  <span className="text-ink-3">{t('analytics.page.salesCountIcu', { count: a.total_quantity })}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <AffluenceHeatmap cells={summary?.heatmap.cells ?? []} isLoading={loadingSummary} />

        <TopVariationsSection rows={summary?.top_variations ?? []} isLoading={loadingSummary} />

        <MemberSalesSection rows={summary?.by_member ?? []} isLoading={loadingSummary} />

        <TreasurySection treasury={summary?.treasury} isLoading={loadingSummary} />

        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <CardTitle>{t('analytics.page.transactionsTitle')}</CardTitle>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">
              {t('analytics.page.operationsCountIcu', { count: txTotal })}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-tile bg-success-bg p-2.5">
              <span className="text-xs font-semibold text-success-strong">{t('analytics.page.inflows')}</span>
              <span className="text-[15px] font-bold text-success-strong">+{fmt(sumIn, language)} F</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-tile bg-danger-bg p-2.5">
              <span className="text-xs font-semibold text-danger-strong">{t('analytics.page.outflows')}</span>
              <span className="text-[15px] font-bold text-danger-strong">−{fmt(sumOut, language)} F</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-[22px] bg-surface-soft p-1">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={opt.value === txType}
                onClick={() => updateUrl({ type: opt.value })}
                className={`min-h-10 rounded-[20px] text-[13px] ${
                  opt.value === txType ? 'bg-surface font-bold text-ink shadow-seg' : 'font-semibold text-ink-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="mt-2 flex flex-col gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />)}
            </div>
          ) : filteredTx.length === 0 ? (
            <p className="py-5 text-center text-sm text-subtle">{t('analytics.page.noTransactionsInPeriod')}</p>
          ) : (
            <div className="flex flex-col">
              {slicedMobile.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-[20px] ${
                      tx.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                    }`}
                  >
                    {tx.type === 'sale' ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">{tx.name}</span>
                    <span className="text-xs text-subtle">{formatTxMeta(tx.created_at, true, tx.type, language, t)}</span>
                  </span>
                  <span className={`whitespace-nowrap text-sm font-bold ${tx.type === 'sale' ? 'text-success' : 'text-danger'}`}>
                    {tx.type === 'sale' ? '+' : '−'}{fmt(Number(tx.amount), language)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {hasMoreMobile ? (
            <button
              type="button"
              onClick={() => setShowAllTx((v) => !v)}
              className="mt-2.5 min-h-[46px] rounded-full border border-line-strong bg-surface text-sm font-bold"
              style={{ color: '#3A20B8' }}
            >
              {showAllTx ? t('analytics.page.collapse') : t('analytics.page.viewTransactionsCount', { count: filteredTx.length })}
            </button>
          ) : null}

          {txTotal > 50 ? (
            <Link href={walletHref} className="mt-2 self-center text-center text-sm font-semibold text-brand-600">
              {t('analytics.page.viewAllInWallet')}
            </Link>
          ) : null}
        </Card>
      </div>
    </>
  )
}
