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
  getAnalyticsOverview,
  getCategoryAnalysis,
  getComparisons,
  getKPIs,
  getAnalyticsTransactions,
  type AnalyticsParams,
  type AnalyticsTransaction,
} from '@/lib/services/analytics'
import { Button, Card, CardTitle, KpiCard, SegmentedControl, FilterChips } from '@/components/waelly'

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
const PERIOD_LABELS: Record<PeriodId, string> = {
  today: "Aujourd'hui",
  '7': '7 jours',
  '30': '30 jours',
  '90': '3 mois',
  '365': '12 mois',
  custom: 'Personnalisé',
}
const COMPARISON_SUFFIX: Record<PeriodId, string> = {
  today: 'vs hier',
  '7': 'vs sem. préc.',
  '30': 'vs mois préc.',
  '90': 'vs trim. préc.',
  '365': 'vs an préc.',
  custom: 'vs période préc.',
}
const COMPARISON_TEXT: Record<PeriodId, string> = {
  today: 'par rapport à hier',
  '7': 'par rapport à la semaine dernière',
  '30': 'par rapport au mois dernier',
  '90': 'par rapport au trimestre précédent',
  '365': "par rapport à l'année précédente",
  custom: 'par rapport à la période précédente',
}

const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const WEEKDAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTH_SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
const MONTH_FULL = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

const Y_STEPS = [100_000, 300_000, 600_000, 2_000_000, 3_000_000]
const DONUT_COLORS = ['#2A1A9E', '#6A4CF0', '#A58CFF', '#DCD4FF']

function snapYMax(max: number): number {
  if (max <= 0) return Y_STEPS[0]
  return Y_STEPS.find((v) => v >= max) ?? max
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n))
const pctFmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(n))

function short(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toFixed(1).replace('.', ',')} M`
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

function formatRangeText(periodId: PeriodId, start: Dayjs, end: Dayjs): string {
  if (periodId === 'today') {
    return `${WEEKDAY_FULL[start.day()]} ${start.date()} ${MONTH_FULL[start.month()]} ${start.year()}`
  }
  if (periodId === '365') {
    const text = `${MONTH_SHORT[start.month()]} ${start.year()} → ${MONTH_SHORT[end.month()].toLowerCase()} ${end.year()}`
    return capitalize(text)
  }
  const sameMonth = start.month() === end.month() && start.year() === end.year()
  const startPart = sameMonth ? `${start.date()}` : `${start.date()} ${MONTH_SHORT[start.month()].toLowerCase()}`
  return capitalize(`${startPart} → ${end.date()} ${MONTH_SHORT[end.month()].toLowerCase()} ${end.year()}`)
}

type TrendPoint = { label: string; value: number }

/** Regroupe les transactions de vente brutes en points de tendance, selon les règles exactes de la maquette par période (jamais 30 points journaliers en dents de scie). */
function buildTrendPoints(
  periodId: PeriodId,
  sales: AnalyticsTransaction[],
  start: Dayjs,
  end: Dayjs,
  compact: boolean
): TrendPoint[] {
  const sorted = [...sales].sort((a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf())

  if (periodId === 'today') {
    const checkpoints = [8, 10, 12, 14, 16, 18]
    let running = 0
    let cursor = 0
    return checkpoints.map((h) => {
      const boundary = start.hour(h).minute(0).second(0)
      while (cursor < sorted.length && dayjs(sorted[cursor].created_at).valueOf() <= boundary.valueOf()) {
        running += Number(sorted[cursor].amount)
        cursor += 1
      }
      return { label: `${h}h`, value: running }
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
    sorted.forEach((t) => {
      const key = dayjs(t.created_at).format('YYYY-MM-DD')
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + Number(t.amount))
    })
    return Array.from(byDay.entries()).map(([key, value]) => ({
      label: WEEKDAY_SHORT[dayjs(key).day()],
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
    sorted.forEach((t) => {
      const key = dayjs(t.created_at).format('YYYY-MM')
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount))
    })
    const entries = Array.from(byMonth.entries()).slice(-12)
    return entries.map(([key, value]) => {
      const m = dayjs(key, 'YYYY-MM')
      const label = compact ? MONTH_SHORT[m.month()][0].toUpperCase() : MONTH_SHORT[m.month()]
      return { label, value }
    })
  }

  // '30 jours' (ou "custom" 15-90 jours) : ~5 points hebdomadaires, jamais 30 points journaliers.
  const bucketCount = Math.min(5, Math.max(1, Math.ceil(daysSpan / 7)))
  const bucketDays = Math.ceil(daysSpan / bucketCount)
  const buckets = Array.from({ length: bucketCount }, () => 0)
  sorted.forEach((t) => {
    const offset = dayjs(t.created_at).startOf('day').diff(start.startOf('day'), 'day')
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor(offset / bucketDays)))
    buckets[idx] += Number(t.amount)
  })
  return buckets.map((value, i) => ({ label: compact ? `S${i + 1}` : `Sem. ${i + 1}`, value }))
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

function formatTxMeta(dateString: string, withType: boolean, type: 'sale' | 'expense'): string {
  const d = dayjs(dateString)
  const today = dayjs().startOf('day')
  const dayPart = d.isSame(today, 'day')
    ? "Aujourd'hui"
    : d.isSame(today.subtract(1, 'day'), 'day')
      ? 'Hier'
      : `${d.date()} ${MONTH_SHORT[d.month()].toLowerCase()}`
  const base = `${dayPart} · ${d.format('HH:mm')}`
  return withType ? `${base} · ${type === 'sale' ? 'Vente' : 'Dépense'}` : base
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tout' },
  { value: 'sale', label: 'Ventes' },
  { value: 'expense', label: 'Dépenses' },
]

const KPI_COLOR = { positive: '#0B8A43', negative: '#D92D20' }

function kpiDeltaPct(change: number | undefined, goodWhenIncreasing: boolean, suffix?: string) {
  if (change === undefined || Number.isNaN(change)) return undefined
  const trend: 'up' | 'down' = change >= 0 ? 'up' : 'down'
  const positive = goodWhenIncreasing ? trend === 'up' : trend === 'down'
  const arrow = trend === 'up' ? '↑' : '↓'
  const text = `${arrow} ${pctFmt(change)} %${suffix ? ` ${suffix}` : ''}`
  return { text, trend, positive }
}

export default function AnalyticsPage() {
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
  const rangeText = formatRangeText(periodId, start, end)
  const queryKeyParams = JSON.stringify(apiParams)
  const enabled = now !== null

  // Analytics suit le même rythme que le Dashboard (données chiffre
  // d'affaires/tendances) : 1 min, pas le défaut 5 min "stock/factures".
  const ANALYTICS_STALE_TIME = 60 * 1000

  const { data: overview, isLoading: loadingOverview, error: overviewError } = useQuery({
    queryKey: keys.analytics.overview(queryKeyParams),
    queryFn: () => getAnalyticsOverview(apiParams),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME,
    enabled,
  })

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

  // Transactions de vente de la période PRÉCÉDENTE (quantité uniquement) :
  // sert au delta de la tuile KPI « Ventes » (quantité vendue vs période
  // précédente).
  const { data: prevSalesTransactions } = useQuery({
    queryKey: keys.analytics.transactions(`${queryKeyParams}:prev-sales`),
    queryFn: () => fetchAllTransactions({ ...prevApiParams, type: 'sale' }),
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

  const queries = [overviewError, kpisError, comparisonsError, categoryError, transactionsError]
  const authError = queries.find((e) => e && getErrorStatus(e) === 401)
  const otherError = queries.find((e) => e && !isSilentError(e) && getErrorStatus(e) !== 401)
  const isLoading = !enabled || loadingOverview || loadingKpis || loadingComparisons || loadingCategory || loadingTransactions

  const salesInPeriod = React.useMemo(
    () => (allTransactions ?? []).filter((t) => t.type === 'sale'),
    [allTransactions]
  )
  const expensesInPeriod = React.useMemo(
    () => (allTransactions ?? []).filter((t) => t.type === 'expense'),
    [allTransactions]
  )
  const trendData = enabled ? buildTrendPoints(periodId, salesInPeriod, start, end, false) : []
  const trendDataMobile = enabled ? buildTrendPoints(periodId, salesInPeriod, start, end, true) : []
  const expenseTrendData = enabled ? buildTrendPoints(periodId, expensesInPeriod, start, end, false) : []
  const expenseTrendDataMobile = enabled ? buildTrendPoints(periodId, expensesInPeriod, start, end, true) : []
  const trendMax = Math.max(0, ...trendData.map((p) => p.value), ...expenseTrendData.map((p) => p.value))
  const yMax = snapYMax(trendMax)

  // Répartition des ventes par article (écart assumé : l'API ne retourne que
  // le top 5 par quantité — cf. note en tête de fichier — donc un article à
  // forte valeur mais faible quantité peut finir dans « Autres »).
  const donutData = React.useMemo(() => {
    const totalSales = overview?.total_sales ?? 0
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
      slices.push({ label: 'Autres', value: Math.round(othersPercent), color: DONUT_COLORS[3] })
    }
    if (slices.length > 1) slices[slices.length - 1].ringColor = '#B9ACF5'
    return slices
  }, [categoryAnalysis, overview])

  const bestArticles = (categoryAnalysis?.top_products ?? []).slice(0, 4)

  const forecastNextMonth = React.useMemo(() => {
    if (!forecastTransactions || !now) return 0
    const byMonth = new Map<string, number>()
    let d = now.subtract(5, 'month').startOf('month')
    for (let i = 0; i < 6; i++) {
      byMonth.set(d.format('YYYY-MM'), 0)
      d = d.add(1, 'month')
    }
    forecastTransactions.forEach((t) => {
      const key = dayjs(t.created_at).format('YYYY-MM')
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount))
    })
    return linearForecast(Array.from(byMonth.values()))
  }, [forecastTransactions, now])

  const nextMonthLabel = now ? capitalize(`${MONTH_FULL[now.add(1, 'month').month()]} ${now.add(1, 'month').year()}`) : ''

  const caDelta = kpiDeltaPct(comparisons?.sales.change, true, COMPARISON_SUFFIX[periodId])
  const expensesDelta = kpiDeltaPct(comparisons?.expenses.change, false)
  const netDelta = kpiDeltaPct(comparisons?.net_revenue.change, true)
  const avgBasketChange =
    kpis && prevKpis && prevKpis.average_basket > 0
      ? ((kpis.average_basket - prevKpis.average_basket) / prevKpis.average_basket) * 100
      : undefined
  const avgBasketDelta = kpiDeltaPct(avgBasketChange, true)

  // « Ventes » = somme des QUANTITÉS vendues sur la période (pas un montant,
  // pas un nombre d'opérations) — à partir du même jeu de transactions que
  // la section « Transactions de la période » plus bas.
  const salesQuantity = salesInPeriod.reduce((a, t) => a + (Number(t.quantity) || 0), 0)
  const prevSalesQuantity = (prevSalesTransactions ?? []).reduce((a, t) => a + (Number(t.quantity) || 0), 0)
  const salesQtyChange =
    prevSalesQuantity > 0
      ? ((salesQuantity - prevSalesQuantity) / prevSalesQuantity) * 100
      : salesQuantity > 0
        ? 100
        : 0
  const salesQtyDelta = kpiDeltaPct(salesQtyChange, true)

  const kpisDesktop = [
    { label: 'Chiffre d’affaires', value: `${fmt(overview?.total_sales ?? 0)} F`, delta: caDelta, hero: true },
    { label: 'Dépenses', value: `${fmt(overview?.total_expenses ?? 0)} F`, delta: expensesDelta, hero: false },
    { label: 'Bénéfice net', value: `${fmt(overview?.net_revenue ?? 0)} F`, delta: netDelta, hero: false },
    { label: 'Ventes', value: fmt(salesQuantity), delta: salesQtyDelta, hero: false },
  ]
  const kpisMobile = [
    { label: 'Chiffre d’affaires', value: fmt(overview?.total_sales ?? 0), delta: caDelta },
    { label: 'Bénéfice net', value: fmt(overview?.net_revenue ?? 0), delta: netDelta },
    { label: 'Panier moyen', value: fmt(kpis?.average_basket ?? 0), delta: avgBasketDelta },
    { label: 'Ventes', value: fmt(salesQuantity), delta: salesQtyDelta },
  ]

  const compareRows = comparisons
    ? [
        { label: 'Chiffre d’affaires', now: comparisons.sales.current, prev: comparisons.sales.previous, change: comparisons.sales.change, good: true },
        { label: 'Dépenses', now: comparisons.expenses.current, prev: comparisons.expenses.previous, change: comparisons.expenses.change, good: false },
        {
          label: 'Nombre de ventes',
          now: kpis?.sales_count ?? 0,
          prev: prevKpis?.sales_count ?? 0,
          change: prevKpis && prevKpis.sales_count > 0 ? ((kpis?.sales_count ?? 0) - prevKpis.sales_count) / prevKpis.sales_count * 100 : 0,
          good: true,
        },
      ]
    : []

  const filteredTx = (allTransactions ?? []).filter((t) => txType === 'all' || t.type === txType)
  const sumIn = salesInPeriod.reduce((a, t) => a + Number(t.amount), 0)
  const sumOut = (allTransactions ?? []).filter((t) => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
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
        <p className="text-sm text-subtle">Redirection vers la connexion…</p>
      </div>
    )
  }

  if (otherError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-12 text-subtle" />
        <p className="text-sm text-subtle">
          {(otherError as Error).message || 'Impossible de charger les analyses.'}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            queryClient.invalidateQueries({
              predicate: (query) => query.queryKey[0] === 'analytics',
            })
          }
        >
          Réessayer
        </Button>
      </div>
    )
  }

  const periodChips = PERIOD_ORDER.map((id) => ({ value: id, label: PERIOD_LABELS[id] }))

  const customDatesDesktop = (
    <div className="flex flex-wrap items-end gap-3 rounded-[20px] bg-surface p-3.5 shadow-card">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="adu" className="text-xs font-semibold text-subtle">Du</label>
        <input
          id="adu"
          type="date"
          value={draftFrom}
          onChange={(e) => setDraftFrom(e.target.value)}
          className="h-11 rounded-xl border border-line-strong px-3 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="aau" className="text-xs font-semibold text-subtle">Au</label>
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
        Appliquer
      </button>
    </div>
  )

  const customDatesMobile = (
    <div className="grid grid-cols-2 gap-2.5 rounded-[18px] border border-line bg-surface p-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="du" className="text-xs font-semibold text-subtle">Du</label>
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
        <label htmlFor="au" className="text-xs font-semibold text-subtle">Au</label>
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
            <h1 className="text-[28px] font-bold tracking-tight text-ink">Analyses</h1>
            <span className="text-sm text-subtle">{rangeText}</span>
          </div>
          <SegmentedControl options={periodChips} value={periodId} onChange={handlePeriodChange} />
        </div>

        {periodId === 'custom' ? customDatesDesktop : null}

        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {isLoading
            ? [1, 2, 3, 4].map((i) => <div key={i} className="h-[120px] animate-pulse rounded-card bg-surface-soft" />)
            : kpisDesktop.map((k) =>
                k.hero ? (
                  <div
                    key={k.label}
                    className="flex flex-col gap-2 rounded-hero bg-hero p-5 text-white shadow-hero"
                  >
                    <span className="text-[13px] text-navy-text">{k.label}</span>
                    <span className="text-[28px] font-bold tracking-tight">{k.value}</span>
                    {k.delta ? <span className="text-[13px] font-bold" style={{ color: '#9FF0C4' }}>{k.delta.text}</span> : null}
                  </div>
                ) : (
                  <KpiCard
                    key={k.label}
                    label={k.label}
                    value={k.value}
                    delta={k.delta?.text}
                    trend={k.delta?.trend ?? 'up'}
                    positive={k.delta?.positive ?? true}
                  />
                )
              )}
        </div>

        <div className="flex flex-wrap gap-5">
          <Card className="flex-[2_1_560px]">
            {isLoading ? (
              <div className="h-[260px] animate-pulse rounded-tile bg-surface-soft" />
            ) : (
              <AreaTrendChart
                title="Tendance des ventes"
                trendPercent={comparisons ? Math.abs(comparisons.sales.change) : undefined}
                trendLabel={COMPARISON_TEXT[periodId]}
                data={trendData}
                secondarySeries={{ data: expenseTrendData, label: 'Dépenses' }}
                yMax={yMax}
                showTooltip
                height={240}
                actions={
                  <span className="rounded-2xl border border-line-strong px-3 py-2 text-[13px] font-semibold">
                    {PERIOD_LABELS[periodId]}
                  </span>
                }
              />
            )}
          </Card>

          <Card className="flex-[1_1_300px]">
            <CardTitle>Répartition des ventes</CardTitle>
            <div className="mt-4">
              {isLoading ? (
                <div className="h-[220px] animate-pulse rounded-tile bg-surface-soft" />
              ) : donutData.length > 0 ? (
                <CategoryDonut
                  data={donutData}
                  centerValue={short(overview?.total_sales ?? 0)}
                  centerLabel="Total ventes"
                />
              ) : (
                <p className="py-10 text-center text-sm text-subtle">Aucune vente sur cette période.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-wrap gap-5">
          <Card className="flex-[1_1_320px]">
            <CardTitle>Comparaison avec la période précédente</CardTitle>
            <div className="mt-3.5 flex flex-col gap-3.5">
              {compareRows.map((row) => {
                const maxVal = Math.max(row.now, row.prev, 1)
                const delta = kpiDeltaPct(row.change, row.good)
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
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-brand-500" />Période actuelle</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-brand-200" />Période précédente</span>
            </div>
          </Card>

          <Card className="flex-[1_1_320px]">
            <CardTitle>Meilleurs articles</CardTitle>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {bestArticles.length === 0 ? (
                <p className="text-sm text-subtle">Aucune vente sur cette période.</p>
              ) : (
                bestArticles.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="w-7 font-extrabold text-brand-500">{i + 1}</span>
                    <span className="flex-1 font-semibold text-ink">{a.name}</span>
                    <span className="text-ink-3">{a.total_quantity} vente{a.total_quantity > 1 ? 's' : ''}</span>
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
            <h2 className="text-lg font-bold">Prévision</h2>
            <span className="text-[34px] font-extrabold tracking-tight">≈ {short(forecastNextMonth)} F</span>
            <p className="text-sm leading-relaxed" style={{ color: '#DCDCF7' }}>
              Estimation (régression linéaire sur les 6 derniers mois) des ventes attendues en {nextMonthLabel} si la
              tendance se poursuit.
            </p>
          </section>
        </div>

        <section className="flex flex-col gap-3.5 rounded-[26px] bg-surface p-5.5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-ink">Transactions de la période</h2>
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">
                {txTotal} opération{txTotal > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-bold text-success-strong">Entrées +{fmt(sumIn)} F</span>
              <span className="text-[13px] font-bold text-danger-strong">Sorties −{fmt(sumOut)} F</span>
              <FilterChips
                options={TYPE_OPTIONS}
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
            <p className="py-6 text-center text-sm text-subtle">Aucune transaction sur cette période.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                    <th className="px-2 py-2.5">Opération</th>
                    <th className="px-2 py-2.5">Type</th>
                    <th className="px-2 py-2.5">Date</th>
                    <th className="px-2 py-2.5 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {slicedDesktop.map((t) => (
                    <tr key={t.id} className="border-t border-divider">
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${
                              t.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                            }`}
                          >
                            {t.type === 'sale' ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                          </span>
                          <span className="font-semibold text-ink">{t.name}</span>
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            t.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                          }`}
                        >
                          {t.type === 'sale' ? 'Vente' : 'Dépense'}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-ink-3">{formatTxMeta(t.created_at, false, t.type)}</td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-right font-bold ${
                          t.type === 'sale' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {t.type === 'sale' ? '+' : '−'}{fmt(Number(t.amount))}
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
              {showAllTx ? 'Réduire' : `Voir les ${filteredTx.length} transactions`}
            </button>
          ) : null}

          {txTotal > 50 ? (
            <Link href={walletHref} className="self-center text-sm font-semibold text-brand-600">
              Tout voir dans le Portefeuille
            </Link>
          ) : null}
        </section>
      </div>

      {/* ============================= MOBILE (< 768px) ============================= */}
      <div className="flex flex-col gap-4.5 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">Analyses</h1>
            <span className="text-[13px] text-subtle">{rangeText}</span>
          </div>
          <button
            type="button"
            onClick={() => handlePeriodChange('custom')}
            aria-label="Choisir des dates"
            className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] font-semibold text-ink shadow-[0_2px_10px_rgba(17,17,80,0.06)]"
          >
            <Calendar className="size-[17px]" strokeWidth={1.9} />
            Dates
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
          {isLoading
            ? [1, 2, 3, 4].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-tile bg-surface-soft" />)
            : kpisMobile.map((k) => (
                <KpiCard
                  key={k.label}
                  label={k.label}
                  value={k.value}
                  delta={k.delta?.text}
                  trend={k.delta?.trend ?? 'up'}
                  positive={k.delta?.positive ?? true}
                />
              ))}
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-ink">Tendance des ventes</span>
            <span className="rounded-2xl border border-line-strong px-3 py-2 text-[13px] font-semibold">
              {PERIOD_LABELS[periodId]}
            </span>
          </div>
          {isLoading ? (
            <div className="mt-2.5 h-[180px] animate-pulse rounded-tile bg-surface-soft" />
          ) : (
            <AreaTrendChart
              trendPercent={comparisons ? Math.abs(comparisons.sales.change) : undefined}
              trendLabel={COMPARISON_TEXT[periodId]}
              data={trendDataMobile}
              secondarySeries={{ data: expenseTrendDataMobile, label: 'Dépenses' }}
              yMax={yMax}
              showTooltip
              height={180}
              className="mt-2.5"
            />
          )}
        </Card>

        <Card>
          <CardTitle>Répartition des ventes</CardTitle>
          <div className="mt-3.5 flex items-center gap-4">
            {isLoading ? (
              <div className="h-[128px] w-[128px] shrink-0 animate-pulse rounded-full bg-surface-soft" />
            ) : donutData.length > 0 ? (
              <CategoryDonut
                data={donutData}
                centerValue={short(overview?.total_sales ?? 0)}
                centerLabel="Total ventes"
                size={128}
                layout="row"
              />
            ) : (
              <p className="py-6 text-sm text-subtle">Aucune vente sur cette période.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2.5">
            <CardTitle>Transactions de la période</CardTitle>
            <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700">
              {txTotal} opération{txTotal > 1 ? 's' : ''}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-tile bg-success-bg p-2.5">
              <span className="text-xs font-semibold text-success-strong">Entrées</span>
              <span className="text-[15px] font-bold text-success-strong">+{fmt(sumIn)} F</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-tile bg-danger-bg p-2.5">
              <span className="text-xs font-semibold text-danger-strong">Sorties</span>
              <span className="text-[15px] font-bold text-danger-strong">−{fmt(sumOut)} F</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-[22px] bg-surface-soft p-1">
            {TYPE_OPTIONS.map((opt) => (
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
            <p className="py-5 text-center text-sm text-subtle">Aucune transaction sur cette période.</p>
          ) : (
            <div className="flex flex-col">
              {slicedMobile.map((t) => (
                <div key={t.id} className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-[20px] ${
                      t.type === 'sale' ? 'bg-success-bg text-success-strong' : 'bg-danger-bg text-danger-strong'
                    }`}
                  >
                    {t.type === 'sale' ? <ArrowUpRight className="size-5" /> : <ArrowDownLeft className="size-5" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                    <span className="text-xs text-subtle">{formatTxMeta(t.created_at, true, t.type)}</span>
                  </span>
                  <span className={`whitespace-nowrap text-sm font-bold ${t.type === 'sale' ? 'text-success' : 'text-danger'}`}>
                    {t.type === 'sale' ? '+' : '−'}{fmt(Number(t.amount))}
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
              {showAllTx ? 'Réduire' : `Voir les ${filteredTx.length} transactions`}
            </button>
          ) : null}

          {txTotal > 50 ? (
            <Link href={walletHref} className="mt-2 self-center text-center text-sm font-semibold text-brand-600">
              Tout voir dans le Portefeuille
            </Link>
          ) : null}
        </Card>
      </div>
    </>
  )
}
