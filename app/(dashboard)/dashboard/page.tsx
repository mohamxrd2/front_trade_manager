'use client'

import * as React from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { formatNumber, formatDate } from '@/lib/i18n/format'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  ChevronRight,
  FileText,
  Package,
  PackagePlus,
  Plus,
  Search,
  Settings,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { useUserStats } from '@/lib/hooks/useArticles'
import { useArticles } from '@/lib/hooks/useArticles'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import {
  getAnalyticsOverview,
  getAnalyticsTrends,
  getCategoryAnalysis,
  getComparisons,
  getKPIs,
  type PeriodType,
} from '@/lib/services/analytics'
import { type Transaction } from '@/lib/services/transactions'
import { useTransactionsQuery } from '@/lib/hooks/useTransactions'
import { getTransactionVisual, paymentMethodIcon } from '@/lib/transactions/transaction-visual'
import { groupTransactionsByOperation, operationGroupTitle } from '@/lib/transactions/group-by-operation'
import { keys } from '@/lib/query-keys'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'
import { OnboardingSkippedBanner } from '@/components/onboarding'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Amount,
  AmountVisibilityToggle,
  Button,
  Card,
  CardHeader,
  CardTitle,
  HeroCard,
  KpiCard,
  SegmentedControl,
  TransactionDetailsDialog,
} from '@/components/waelly'

// Recharts (AreaTrendChart, CategoryDonut) mesure le conteneur et génère des
// identifiants internes côté navigateur : rendu côté serveur, ces deux
// composants produisaient un HTML différent de celui du client et
// déclenchaient une erreur d'hydratation. Chargés uniquement côté client.
const AreaTrendChart = dynamic(
  () => import('@/components/waelly/area-trend-chart').then((m) => m.AreaTrendChart),
  { ssr: false }
)
const CategoryDonut = dynamic(
  () => import('@/components/waelly/category-donut').then((m) => m.CategoryDonut),
  { ssr: false }
)

// PÉRIODE_OPTIONS utilise désormais des clés de traduction (dashboard.period.*)
// résolues au rendu, pas un libellé fixe — voir leur usage plus bas.
const PERIOD_OPTIONS: { value: PeriodType; labelKey: string }[] = [
  { value: 'today', labelKey: 'dashboard.period.today' },
  { value: '7', labelKey: 'dashboard.period.7d' },
  { value: '30', labelKey: 'dashboard.period.30d' },
  { value: 'year', labelKey: 'dashboard.period.year' },
  { value: 'all', labelKey: 'dashboard.period.allTime' },
]

// Reprend la détection "nouvelle donnée" de components/analytics/overview-cards.tsx
// (previous = 0, variation non significative), mais formate désormais selon
// la langue active à une décimale maximum, sans flèche embarquée dans le
// texte — la direction (↑/↓) est portée séparément par KpiCard via `trend`,
// jamais dans la chaîne elle-même (sinon flèche en double ou contradictoire).
function formatVariation(
  change: number | null | undefined,
  previous: number | null | undefined,
  current: number | null | undefined,
  language: AppLanguage,
  newLabel: string
): { value: string; isNew: boolean } {
  if (change === null || change === undefined || isNaN(change)) {
    return { value: '0 %', isNew: false }
  }
  if (previous === 0 && current !== null && current !== undefined && current > 0) {
    if (Math.abs(change) > 10000 || !isFinite(change)) {
      return { value: newLabel, isNew: true }
    }
  }
  return { value: `${formatNumber(Math.abs(change), language, { maximumFractionDigits: 1 })} %`, isNew: false }
}

type ComparisonMetric = { change: number; change_type: 'increase' | 'decrease'; previous: number; current: number }

// `goodWhenIncreasing` : pour les ventes/le bénéfice une hausse est positive
// (verte) ; pour les dépenses une hausse est négative (rouge). La flèche,
// elle, suit TOUJOURS le sens réel de la variation (trend), jamais la
// couleur — ce sont deux choses indépendantes.
function kpiDelta(
  metric: ComparisonMetric | undefined,
  goodWhenIncreasing: boolean,
  language: AppLanguage,
  newLabel: string
) {
  if (!metric) return { delta: undefined, trend: 'up' as const, positive: true }
  const { value, isNew } = formatVariation(metric.change, metric.previous, metric.current, language, newLabel)
  const trend: 'up' | 'down' = metric.change_type === 'increase' ? 'up' : 'down'
  const positive = isNew ? true : goodWhenIncreasing ? trend === 'up' : trend === 'down'
  return { delta: value, trend, positive }
}

// Regroupe les points quotidiens bruts de l'API pour éviter un tracé en
// dents de scie : un point par jour sur 7 jours (et "Aujourd'hui", un seul
// point), ~5 points (hebdomadaires) sur 30 jours, un point par mois sur
// 12 mois, un point par année pour "Depuis toujours". `language` pilote le
// format des libellés (ex. "Mon"/"lun.", "Jan"/"janv.") — jamais un
// dayjs.locale() global, voir lib/i18n/format.ts.
function bucketTrendPoints(
  points: { date: string; amount: number }[],
  period: PeriodType,
  language: AppLanguage
): { label: string; value: number }[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

  if (period === '7' || period === 'today') {
    return sorted.map((p) => ({ label: formatDate(p.date, language, 'ddd'), value: p.amount }))
  }

  if (period === 'year') {
    const byMonth = new Map<string, number>()
    sorted.forEach((p) => {
      const key = dayjs(p.date).format('YYYY-MM')
      byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount)
    })
    return Array.from(byMonth.entries()).map(([key, value]) => ({
      label: formatDate(dayjs(key, 'YYYY-MM').toDate(), language, 'MMM'),
      value,
    }))
  }

  if (period === 'all') {
    const byYear = new Map<string, number>()
    sorted.forEach((p) => {
      const key = dayjs(p.date).format('YYYY')
      byYear.set(key, (byYear.get(key) ?? 0) + p.amount)
    })
    return Array.from(byYear.entries()).map(([label, value]) => ({ label, value }))
  }

  // Période "30 jours" (ou autre) : ~5 points, regroupés par semaine civile.
  const byWeek = new Map<string, { total: number; lastDate: string }>()
  sorted.forEach((p) => {
    const key = dayjs(p.date).startOf('week').format('YYYY-MM-DD')
    const existing = byWeek.get(key)
    if (existing) {
      existing.total += p.amount
      if (p.date > existing.lastDate) existing.lastDate = p.date
    } else {
      byWeek.set(key, { total: p.amount, lastDate: p.date })
    }
  })
  return Array.from(byWeek.values()).map(({ total, lastDate }) => ({
    label: formatDate(lastDate, language, 'DD/MM'),
    value: total,
  }))
}

// Reprend exactement le calcul de montant de components/wallet/transaction-card.tsx
function formatTransactionMeta(dateString: string, language: AppLanguage, todayLabel: string, yesterdayLabel: string): string {
  const d = dayjs(dateString)
  const today = dayjs().startOf('day')
  if (d.isSame(today, 'day')) return `${todayLabel}, ${formatDate(dateString, language, 'HH:mm')}`
  if (d.isSame(today.subtract(1, 'day'), 'day')) return `${yesterdayLabel}, ${formatDate(dateString, language, 'HH:mm')}`
  return formatDate(dateString, language, 'DD/MM, HH:mm')
}

/**
 * Tableau de bord — reprend design/maquettes/ordinateur/Web-Tableau.dc.html
 * (≥ 1024px) et design/maquettes/mobile/Main.dc.html (< 768px), valeurs
 * exactes des styles inline, avec les composants communs waelly/*.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const { t, language } = useTranslation()
  const { currency } = useCurrency()
  const { unreadCount } = useNotifications()
  const [period, setPeriod] = React.useState<PeriodType>('today')
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null)

  // Calculé uniquement après le montage : dayjs() dépend de l'horloge au
  // moment du rendu, qui diffère entre le serveur et le client et
  // provoquait une erreur d'hydratation sur ce texte.
  const [todayLabel, setTodayLabel] = React.useState('')
  React.useEffect(() => {
    setTodayLabel(formatDate(new Date(), language, 'dddd D MMMM YYYY'))
  }, [language])

  // Statistiques utilisateur — gate de chargement/erreur de la page, inchangé.
  const { error, isLoading } = useUserStats()

  const apiParams = { period }
  // Même logique que app/(dashboard)/analytics/page.tsx : rafraîchissement
  // immédiat pour "Aujourd'hui", cache plus long pour "Depuis toujours".
  const staleTime = period === 'all' ? 5 * 60 * 1000 : period === 'today' ? 0 : 1 * 60 * 1000

  const periodKey = JSON.stringify(apiParams)

  const { data: overview, isLoading: isLoadingOverview } = useQuery({
    queryKey: keys.dashboard.overview(periodKey),
    queryFn: () => getAnalyticsOverview(apiParams),
    staleTime,
  })

  // Pas de période précédente pertinente pour "Depuis toujours" — comparaison
  // désactivée, les KpiCard n'afficheront alors simplement aucune variation.
  const { data: comparisons } = useQuery({
    queryKey: keys.dashboard.comparisons(periodKey),
    queryFn: () => getComparisons(apiParams),
    enabled: period !== 'all',
    staleTime,
  })

  const { data: kpis } = useQuery({
    queryKey: keys.dashboard.kpis(periodKey),
    queryFn: () => getKPIs(apiParams),
    staleTime,
  })

  const { data: trends, isLoading: isLoadingTrends } = useQuery({
    queryKey: keys.dashboard.trends(periodKey),
    queryFn: () => getAnalyticsTrends({ ...apiParams, type: 'both' }),
    staleTime,
  })

  const { data: categoryAnalysis } = useQuery({
    queryKey: keys.dashboard.categoryDonut(periodKey),
    queryFn: () => getCategoryAnalysis(apiParams),
    staleTime,
  })

  // Même cache que le Portefeuille (keys.transactions.list(), via
  // useTransactionsQuery) — avant : sa propre clé keys.dashboard.transactions()
  // avec un slice(0, 5) mis en cache séparément, donc une suppression côté
  // Portefeuille ne se répercutait jamais ici sans rechargement de page.
  const { data: allTransactions = [], isLoading: isLoadingTransactions } = useTransactionsQuery()
  // Regroupe par opération AVANT de limiter aux 5 plus récentes : une
  // opération multi-lignes (panier) compte pour UNE seule ligne affichée,
  // jamais coupée en deux par la limite (voir lib/transactions/group-by-operation.ts).
  const transactions = React.useMemo(() => groupTransactionsByOperation(allTransactions).slice(0, 5), [allTransactions])

  const { articles } = useArticles()
  const lowStockArticles = React.useMemo(
    () => articles.filter((article) => article.low_stock),
    [articles]
  )

  // Afficher le skeleton pendant le chargement (inchangé)
  if (isLoading) {
    return <DashboardSkeleton />
  }

  // Afficher les erreurs (inchangé)
  if (error) {
    const isAuthError = error.message.includes('Non authentifié') // i18n:allow — sentinelle interne (lib/services/articles.ts), jamais affichée

    if (isAuthError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">{t('dashboard.redirectingToLogin')}</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('dashboard.loadError')}</AlertTitle>
          <AlertDescription>
            {error.message || t('dashboard.loadErrorGeneric')}
            <br />
            <span className="text-xs mt-2 block">
              {t('dashboard.loadErrorHint')}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  const periodOptions = PERIOD_OPTIONS.map((p) => ({ value: p.value, label: t(p.labelKey) }))
  const trendData = bucketTrendPoints(trends?.sales_expenses?.sales ?? [], period, language)

  const newLabel = t('dashboard.kpi.new')
  const salesChange = comparisons
    ? formatVariation(comparisons.sales.change, comparisons.sales.previous, comparisons.sales.current, language, newLabel)
    : null

  // « Ventes par article » : dérivé du top 5 déjà chargé pour le graphique
  // plus bas (categoryAnalysis.top_products), pas d'appel API supplémentaire.
  // Pourcentage de chaque article = sa part du chiffre d'affaires total de
  // la période ; le reste (produits hors top 5) regroupé en « Autres ».
  const donutData = (() => {
    const totalSales = overview?.total_sales ?? 0
    const topProducts = categoryAnalysis?.top_products ?? []
    if (totalSales <= 0 || topProducts.length === 0) return []

    const slices = topProducts.map((product) => ({
      label: product.name,
      value: Math.round((product.total_amount / totalSales) * 100),
    }))
    const othersPercent = Math.max(
      0,
      100 - topProducts.reduce((sum, p) => sum + (p.total_amount / totalSales) * 100, 0)
    )
    if (othersPercent >= 1) {
      slices.push({ label: t('dashboard.otherCategory'), value: Math.round(othersPercent) })
    }
    return slices
  })()

  const kpiCards = [
    {
      label: t('dashboard.kpi.revenue'),
      value: <Amount value={overview?.total_sales ?? 0} currency />,
      ...kpiDelta(comparisons?.sales, true, language, newLabel),
      dotColor: '#5B3FE6',
    },
    {
      label: t('dashboard.kpi.expenses'),
      value: <Amount value={overview?.total_expenses ?? 0} currency />,
      ...kpiDelta(comparisons?.expenses, false, language, newLabel),
      dotColor: '#E5484D',
    },
    {
      label: t('dashboard.kpi.netProfit'),
      value: <Amount value={overview?.net_revenue ?? 0} currency />,
      ...kpiDelta(comparisons?.net_revenue, true, language, newLabel),
      dotColor: '#0B8A43',
    },
    {
      label: t('dashboard.kpi.averageBasket'),
      value: <Amount value={kpis?.average_basket ?? 0} currency />,
      delta: undefined,
      trend: 'up' as const,
      positive: true,
      dotColor: '#2B2BD9',
    },
  ]

  const heroActions = (
    <>
      <Button variant="secondary" className="flex-1" asChild>
        <Link href="/wallet/new?type=sale">
          <ArrowUpRight className="size-[17px]" />
          {t('common.sale')}
        </Link>
      </Button>
      <Button variant="secondary" className="flex-1" asChild>
        <Link href="/wallet/new?type=expense">
          <ArrowDownLeft className="size-[17px]" />
          {t('common.expense')}
        </Link>
      </Button>
      <Button
        variant="secondary"
        className="flex-1 border border-white/30 bg-white/14 font-semibold text-white hover:bg-white/20"
        asChild
      >
        <Link href="/invoices/new">{t('common.invoice')}</Link>
      </Button>
    </>
  )

  const notificationsAriaLabel = t('dashboard.notificationsAria', { count: unreadCount })

  return (
    <div className="flex flex-col gap-5">
      <OnboardingSkippedBanner />

      {/* --- En-tête mobile (< 768px) --- */}
      <div className="flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label={t('nav.settings')}
            className="flex size-11 items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white"
          >
            {initials}
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-subtle">{t('dashboard.greeting', { name: user?.first_name ?? '' })}</span>
            <span className="text-lg font-bold text-ink">{t('dashboard.title')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label={t('nav.settings')}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <Settings className="size-[20px]" strokeWidth={1.8} />
          </Link>
          <Link
            href="/notifications"
            aria-label={notificationsAriaLabel}
            className="relative flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <Bell className="size-[22px]" strokeWidth={1.8} />
            {unreadCount > 0 ? (
              <span className="absolute right-2.5 top-2.5 size-[9px] rounded-full border-2 border-surface bg-danger-dot" />
            ) : null}
          </Link>
        </div>
      </div>

      {/* --- En-tête ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-wrap items-center justify-between gap-3.5 lg:flex">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">
            {t('dashboard.greeting', { name: user?.first_name ?? '' })}
          </h1>
          <span className="text-sm text-subtle">
            {t('dashboard.activitySummary', { date: todayLabel })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-[18px] text-subtle" />
            <input
              placeholder={t('dashboard.searchPlaceholder')}
              className="glass h-12 w-[300px] max-w-full rounded-full pl-11 pr-4 text-sm text-ink outline-none"
            />
          </div>
          <AmountVisibilityToggle variant="glass" />
          <Link
            href="/notifications"
            aria-label={notificationsAriaLabel}
            className="glass relative flex size-12 items-center justify-center rounded-full text-ink"
          >
            <Bell className="size-5" strokeWidth={1.8} />
            {unreadCount > 0 ? (
              <span className="absolute right-3.5 top-3 size-2 rounded-full bg-danger-dot" />
            ) : null}
          </Link>
          <Button variant="primary" asChild>
            <Link href="/wallet/new?type=sale">
              <Plus className="size-[18px]" strokeWidth={2.2} />
              {t('nav.newSale')}
            </Link>
          </Button>
        </div>
      </div>

      {/* --- Héros + grille KPI --- */}
      <div className="flex flex-wrap gap-5">
        <div className="flex-[2_1_400px]">
          {isLoadingOverview ? (
            <div className="h-full min-h-[220px] animate-pulse rounded-hero bg-surface-soft" />
          ) : (
            <HeroCard
              label={t('common.balance')}
              period={periodOptions.find((p) => p.value === period)?.label}
              eyeButton={<AmountVisibilityToggle variant="hero" />}
              amount={<Amount value={overview?.net_revenue ?? 0} />}
              currency={currency}
              stats={[
                { label: t('common.sales'), value: <>+<Amount value={overview?.total_sales ?? 0} /></> },
                { label: t('common.expenses'), value: <>−<Amount value={overview?.total_expenses ?? 0} /></> },
              ]}
              actions={heroActions}
            />
          )}
        </div>

        <div className="hidden flex-[3_1_460px] flex-col gap-3.5 lg:flex">
          <SegmentedControl
            className="self-start"
            options={periodOptions}
            value={period}
            onChange={(v) => setPeriod(v as PeriodType)}
            ariaLabel={t('common.period')}
          />
          <div className="grid flex-1 grid-cols-2 gap-3.5">
            {isLoadingOverview
              ? [1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse rounded-card bg-surface-soft" />
                ))
              : kpiCards.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
          </div>
        </div>
      </div>

      {/* --- Actions rapides (mobile uniquement — grille à 4 icônes de Main.dc.html) --- */}
      <div className="grid grid-cols-4 gap-2.5 lg:hidden">
        <Link
          href="/wallet/new?type=sale"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile bg-orb text-white">
            <Plus className="size-6" strokeWidth={1.9} />
          </span>
          {t('common.sale')}
        </Link>
        <Link
          href="/wallet/new?type=expense"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile border border-line bg-surface">
            <ArrowDownLeft className="size-6" strokeWidth={1.9} />
          </span>
          {t('common.expense')}
        </Link>
        <Link
          href="/invoices/new"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile border border-line bg-surface">
            <FileText className="size-6" strokeWidth={1.8} />
          </span>
          {t('common.invoice')}
        </Link>
        <Link
          href="/products"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile border border-line bg-surface">
            <PackagePlus className="size-6" strokeWidth={1.8} />
          </span>
          {t('dashboard.quickRestock')}
        </Link>
      </div>

      {/* --- Stock faible : bandeau mobile (Main.dc.html l'affiche ici, avant
           le graphique de tendance ; sur ordinateur il rejoint Dernières
           opérations en deux colonnes plus bas, comme Web-Tableau.dc.html) --- */}
      {lowStockArticles.length > 0 ? (
        <Link
          href="/products"
          className="flex min-h-11 items-center gap-3 rounded-tile bg-warning-bg px-4 py-3.5 text-warning lg:hidden"
        >
          <Package className="size-[22px]" strokeWidth={1.9} />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-bold">
              {t('dashboard.lowStockBanner', { count: lowStockArticles.length })}
            </span>
            <span className="text-[13px]">
              {lowStockArticles.slice(0, 3).map((a) => a.name).join(', ')}
            </span>
          </span>
          <ChevronRight className="size-[18px]" strokeWidth={2} />
        </Link>
      ) : null}

      {/* --- Tendance + répartition (donut masqué sur mobile, absent de Main.dc.html) --- */}
      <div className="flex flex-wrap gap-5">
        <Card className="flex-[2_1_520px]">
          {isLoadingTrends ? (
            <div className="h-[220px] animate-pulse rounded-tile bg-surface-soft" />
          ) : (
            <AreaTrendChart
              title={t('dashboard.salesTrend')}
              trendPercent={
                salesChange?.isNew || comparisons === undefined
                  ? undefined
                  : Math.abs(comparisons.sales.change)
              }
              data={trendData}
            />
          )}
        </Card>
        <Card className="hidden flex-[1_1_300px] lg:block">
          <CardHeader>
            <CardTitle>{t('dashboard.salesByProduct')}</CardTitle>
          </CardHeader>
          <div className="mt-4">
            {donutData.length > 0 ? (
              <CategoryDonut
                data={donutData}
                centerValue={<Amount value={overview?.total_sales ?? 0} />}
                centerLabel={`${currency} · ${t('dashboard.periodSuffix')}`}
              />
            ) : (
              <p className="py-10 text-center text-sm text-subtle">{t('common.noData')}</p>
            )}
          </div>
        </Card>
      </div>

      {/* --- Dernières opérations + Stock faible : deux colonnes dès
           l'ordinateur, exactement comme Web-Tableau.dc.html --- */}
      <div className="flex flex-wrap gap-5">
        <Card className="min-w-0 flex-[2_1_520px] p-0">
          <div className="flex items-center justify-between p-5 pb-0">
            <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
            <Link href="/wallet" className="text-sm font-semibold text-brand-600">
              {t('common.viewAll')}
            </Link>
          </div>

          {isLoadingTransactions ? (
            <div className="flex flex-col gap-2 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="p-5 text-center text-sm text-subtle">{t('dashboard.noRecentTransactions')}</p>
          ) : (
            <>
              {/* Liste mobile — construite à la main (pas <TransactionRow>,
                   limité à 2 couleurs income/expense) : un apport/retrait a
                   sa propre couleur (indigo/orange), ne doit jamais être
                   confondu avec une vente/dépense. Même raison que
                   wallet/page.tsx (voir son commentaire de tête). */}
              <div className="divide-y divide-divider lg:hidden">
                {transactions.map((opGroup) => {
                  const transaction = opGroup.lines[0]
                  const visual = getTransactionVisual(opGroup.type)
                  const Icon = visual.Icon
                  const PaymentIcon = paymentMethodIcon(opGroup.paymentMethod)
                  const title = operationGroupTitle(opGroup, t)
                  return (
                    <button
                      key={opGroup.operationId}
                      type="button"
                      onClick={() => setSelectedTransaction(transaction)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-soft"
                    >
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${visual.iconClassName}`}>
                        <Icon className="size-5" strokeWidth={1.9} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-ink">{title}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-subtle">
                          {t(visual.labelKey)} · {formatTransactionMeta(opGroup.date, language, t('common.today'), t('common.yesterday'))}
                          {opGroup.paymentMethod ? <PaymentIcon className="size-3 shrink-0" strokeWidth={2} /> : null}
                        </span>
                      </span>
                      <span className={`shrink-0 text-sm font-bold ${visual.amountClassName}`}>
                        {visual.sign}
                        <Amount value={opGroup.amount} />
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Tableau ordinateur */}
              <div className="hidden overflow-x-auto p-5 pt-3 lg:block">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                      <th className="px-2 py-2.5">{t('dashboard.operationColumn')}</th>
                      <th className="px-2 py-2.5">{t('dashboard.typeColumn')}</th>
                      <th className="px-2 py-2.5">{t('dashboard.dateColumn')}</th>
                      <th className="px-2 py-2.5 text-right">{t('dashboard.amountColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((opGroup) => {
                      const transaction = opGroup.lines[0]
                      const visual = getTransactionVisual(opGroup.type)
                      const title = operationGroupTitle(opGroup, t)
                      return (
                        <tr
                          key={opGroup.operationId}
                          onClick={() => setSelectedTransaction(transaction)}
                          className="cursor-pointer border-t border-divider hover:bg-surface-soft"
                        >
                          <td className="px-2 py-3">
                            <span className="flex items-center gap-3">
                              <span className={`flex size-[38px] shrink-0 items-center justify-center rounded-2xl text-xs font-bold ${visual.iconClassName}`}>
                                {title.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="font-semibold text-ink">{title}</span>
                            </span>
                          </td>
                          <td className="px-2 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${visual.badgeClassName}`}>
                              {t(visual.labelKey)}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-ink-3">{formatTransactionMeta(opGroup.date, language, t('common.today'), t('common.yesterday'))}</td>
                          <td className={`whitespace-nowrap px-2 py-3 text-right font-bold ${visual.amountClassName}`}>
                            {visual.sign}
                            <Amount value={opGroup.amount} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {lowStockArticles.length > 0 ? (
          <Card className="hidden flex-[1_1_300px] flex-col gap-3 lg:flex">
            <CardHeader>
              <CardTitle>{t('dashboard.lowStock')}</CardTitle>
              <span className="rounded-full bg-danger-bg px-2.5 py-1 text-xs font-bold text-danger-strong">
                {t('dashboard.alertCount', { count: lowStockArticles.length })}
              </span>
            </CardHeader>
            <div className="flex flex-col gap-1">
              {lowStockArticles.slice(0, 5).map((article) => (
                <div key={article.id} className="flex items-center gap-3 py-1.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-danger-bg text-sm font-bold text-danger-strong">
                    {article.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex justify-between text-sm">
                      <span className="font-semibold text-ink">{article.name}</span>
                      <span className="font-bold text-danger-strong">
                        {t('dashboard.remainingQuantity', { count: article.remaining_quantity })}
                      </span>
                    </span>
                    <span className="h-[5px] rounded-full bg-divider">
                      <span
                        className="block h-full rounded-full bg-danger-dot"
                        style={{ width: `${Math.min(100, article.sales_percentage)}%` }}
                      />
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <Button variant="secondary" asChild className="mt-auto">
              <Link href="/products">{t('dashboard.viewStock')}</Link>
            </Button>
          </Card>
        ) : null}
      </div>

      <TransactionDetailsDialog
        transaction={selectedTransaction}
        onOpenChange={(open) => { if (!open) setSelectedTransaction(null) }}
      />
    </div>
  )
}
