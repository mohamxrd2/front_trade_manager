'use client'

import * as React from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
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
import { getTransactions, type Transaction } from '@/lib/services/transactions'
import { keys } from '@/lib/query-keys'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'
import { OnboardingSkippedBanner } from '@/components/onboarding'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  HeroCard,
  KpiCard,
  SegmentedControl,
  TransactionDetailsDialog,
  TransactionRow,
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

dayjs.locale('fr')

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
  { value: 'year', label: '12 mois' },
  { value: 'all', label: 'Depuis toujours' },
]

// Reprend la détection "nouvelle donnée" de components/analytics/overview-cards.tsx
// (previous = 0, variation non significative), mais formate désormais en
// français à une décimale maximum, sans flèche embarquée dans le texte —
// la direction (↑/↓) est portée séparément par KpiCard via `trend`, jamais
// dans la chaîne elle-même (sinon flèche en double ou contradictoire).
const PERCENT_FORMATTER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

function formatVariation(
  change: number | null | undefined,
  previous: number | null | undefined,
  current: number | null | undefined
): { value: string; isNew: boolean } {
  if (change === null || change === undefined || isNaN(change)) {
    return { value: '0 %', isNew: false }
  }
  if (previous === 0 && current !== null && current !== undefined && current > 0) {
    if (Math.abs(change) > 10000 || !isFinite(change)) {
      return { value: 'Nouveau', isNew: true }
    }
  }
  return { value: `${PERCENT_FORMATTER.format(Math.abs(change))} %`, isNew: false }
}

type ComparisonMetric = { change: number; change_type: 'increase' | 'decrease'; previous: number; current: number }

// `goodWhenIncreasing` : pour les ventes/le bénéfice une hausse est positive
// (verte) ; pour les dépenses une hausse est négative (rouge). La flèche,
// elle, suit TOUJOURS le sens réel de la variation (trend), jamais la
// couleur — ce sont deux choses indépendantes.
function kpiDelta(metric: ComparisonMetric | undefined, goodWhenIncreasing: boolean) {
  if (!metric) return { delta: undefined, trend: 'up' as const, positive: true }
  const { value, isNew } = formatVariation(metric.change, metric.previous, metric.current)
  const trend: 'up' | 'down' = metric.change_type === 'increase' ? 'up' : 'down'
  const positive = isNew ? true : goodWhenIncreasing ? trend === 'up' : trend === 'down'
  return { delta: value, trend, positive }
}

// Regroupe les points quotidiens bruts de l'API pour éviter un tracé en
// dents de scie : un point par jour sur 7 jours (et "Aujourd'hui", un seul
// point), ~5 points (hebdomadaires) sur 30 jours, un point par mois sur
// 12 mois, un point par année pour "Depuis toujours".
function bucketTrendPoints(
  points: { date: string; amount: number }[],
  period: PeriodType
): { label: string; value: number }[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

  if (period === '7' || period === 'today') {
    return sorted.map((p) => ({ label: dayjs(p.date).format('ddd'), value: p.amount }))
  }

  if (period === 'year') {
    const byMonth = new Map<string, number>()
    sorted.forEach((p) => {
      const key = dayjs(p.date).format('YYYY-MM')
      byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount)
    })
    return Array.from(byMonth.entries()).map(([key, value]) => ({
      label: dayjs(key, 'YYYY-MM').format('MMM'),
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
    label: dayjs(lastDate).format('DD/MM'),
    value: total,
  }))
}

// Reprend exactement le calcul de montant de components/wallet/transaction-card.tsx
function getTransactionAmount(transaction: Transaction): number {
  if (transaction.type === 'sale') {
    return (transaction.quantity || 0) * (transaction.unit_price || 0)
  }
  return transaction.amount || 0
}

function formatTransactionMeta(dateString: string): string {
  const d = dayjs(dateString)
  const today = dayjs().startOf('day')
  if (d.isSame(today, 'day')) return `Aujourd'hui, ${d.format('HH:mm')}`
  if (d.isSame(today.subtract(1, 'day'), 'day')) return `Hier, ${d.format('HH:mm')}`
  return d.format('DD/MM, HH:mm')
}

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

/**
 * Tableau de bord — reprend design/maquettes/ordinateur/Web-Tableau.dc.html
 * (≥ 1024px) et design/maquettes/mobile/Main.dc.html (< 768px), valeurs
 * exactes des styles inline, avec les composants communs waelly/*.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const { unreadCount } = useNotifications()
  const [period, setPeriod] = React.useState<PeriodType>('30')
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null)

  // Calculé uniquement après le montage : dayjs() dépend de l'horloge au
  // moment du rendu, qui diffère entre le serveur et le client et
  // provoquait une erreur d'hydratation sur ce texte.
  const [todayLabel, setTodayLabel] = React.useState('')
  React.useEffect(() => {
    setTodayLabel(dayjs().format('dddd D MMMM YYYY'))
  }, [])

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

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: keys.dashboard.transactions(),
    queryFn: async () => {
      const data = await getTransactions()
      return data.slice(0, 5)
    },
    staleTime: 60 * 1000, // Dashboard/Portefeuille : 1 min
  })

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
    const isAuthError = error.message.includes('Non authentifié')

    if (isAuthError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Redirection vers la page de connexion...</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription>
            {error.message || 'Une erreur est survenue lors du chargement des données.'}
            <br />
            <span className="text-xs mt-2 block">
              Veuillez rafraîchir la page ou contacter le support si le problème persiste.
            </span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'

  const trendData = bucketTrendPoints(trends?.sales_expenses?.sales ?? [], period)

  const salesChange = comparisons
    ? formatVariation(comparisons.sales.change, comparisons.sales.previous, comparisons.sales.current)
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
      slices.push({ label: 'Autres', value: Math.round(othersPercent) })
    }
    return slices
  })()

  const kpiCards = [
    {
      label: 'Chiffre d’affaires',
      value: `${formatAmount(overview?.total_sales ?? 0)} F`,
      ...kpiDelta(comparisons?.sales, true),
      dotColor: '#5B3FE6',
    },
    {
      label: 'Dépenses',
      value: `${formatAmount(overview?.total_expenses ?? 0)} F`,
      ...kpiDelta(comparisons?.expenses, false),
      dotColor: '#E5484D',
    },
    {
      label: 'Bénéfice net',
      value: `${formatAmount(overview?.net_revenue ?? 0)} F`,
      ...kpiDelta(comparisons?.net_revenue, true),
      dotColor: '#0B8A43',
    },
    {
      label: 'Panier moyen',
      value: `${formatAmount(kpis?.average_basket ?? 0)} F`,
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
          Vente
        </Link>
      </Button>
      <Button variant="secondary" className="flex-1" asChild>
        <Link href="/wallet/new?type=expense">
          <ArrowDownLeft className="size-[17px]" />
          Dépense
        </Link>
      </Button>
      <Button
        variant="secondary"
        className="flex-1 border border-white/30 bg-white/14 font-semibold text-white hover:bg-white/20"
        asChild
      >
        <Link href="/invoices/new">Facture</Link>
      </Button>
    </>
  )

  return (
    <div className="flex flex-col gap-5">
      <OnboardingSkippedBanner />

      {/* --- En-tête mobile (< 768px) --- */}
      <div className="flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label="Paramètres"
            className="flex size-11 items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white"
          >
            {initials}
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-subtle">Bonjour, {user?.first_name}</span>
            <span className="text-lg font-bold text-ink">{t('dashboard.title') || 'Tableau de bord'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label="Paramètres"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <Settings className="size-[20px]" strokeWidth={1.8} />
          </Link>
          <Link
            href="/notifications"
            aria-label={`Notifications, ${unreadCount} non lues`}
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
            Bonjour, {user?.first_name}
          </h1>
          <span className="text-sm text-subtle">
            {todayLabel} · voici votre activité
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex">
            <Search className="pointer-events-none absolute left-4 top-3.5 size-[18px] text-subtle" />
            <input
              placeholder="Rechercher article, client, facture…"
              className="glass h-12 w-[300px] max-w-full rounded-full pl-11 pr-4 text-sm text-ink outline-none"
            />
          </div>
          <Link
            href="/notifications"
            aria-label={`Notifications, ${unreadCount} non lues`}
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
              Nouvelle vente
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
              label="Solde"
              period={PERIOD_OPTIONS.find((p) => p.value === period)?.label}
              amount={formatAmount(overview?.net_revenue ?? 0)}
              currency={currency}
              stats={[
                { label: 'Ventes', value: `+${formatAmount(overview?.total_sales ?? 0)}` },
                { label: 'Dépenses', value: `−${formatAmount(overview?.total_expenses ?? 0)}` },
              ]}
              actions={heroActions}
            />
          )}
        </div>

        <div className="hidden flex-[3_1_460px] flex-col gap-3.5 lg:flex">
          <SegmentedControl
            className="self-start"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(v) => setPeriod(v as PeriodType)}
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
          Vente
        </Link>
        <Link
          href="/wallet/new?type=expense"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile border border-line bg-surface">
            <ArrowDownLeft className="size-6" strokeWidth={1.9} />
          </span>
          Dépense
        </Link>
        <Link
          href="/invoices/new"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile border border-line bg-surface">
            <FileText className="size-6" strokeWidth={1.8} />
          </span>
          Facture
        </Link>
        <Link
          href="/products"
          className="flex flex-col items-center gap-2 text-xs font-semibold text-ink"
        >
          <span className="flex size-14 items-center justify-center rounded-tile border border-line bg-surface">
            <PackagePlus className="size-6" strokeWidth={1.8} />
          </span>
          Réappro
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
              {lowStockArticles.length} article{lowStockArticles.length > 1 ? 's' : ''} en stock faible
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
              title="Tendance des ventes"
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
            <CardTitle>Ventes par article</CardTitle>
          </CardHeader>
          <div className="mt-4">
            {donutData.length > 0 ? (
              <CategoryDonut
                data={donutData}
                centerValue={formatAmount(overview?.total_sales ?? 0)}
                centerLabel={`${currency} · période`}
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
            <CardTitle>Dernières opérations</CardTitle>
            <Link href="/wallet" className="text-sm font-semibold text-brand-600">
              Tout voir
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
              {/* Liste mobile */}
              <div className="divide-y divide-divider lg:hidden">
                {transactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    icon={
                      transaction.type === 'sale' ? (
                        <ArrowUpRight className="size-5" strokeWidth={1.9} />
                      ) : (
                        <ArrowDownLeft className="size-5" strokeWidth={1.9} />
                      )
                    }
                    title={transaction.name}
                    meta={`${transaction.type === 'sale' ? 'Vente' : 'Dépense'} · ${formatTransactionMeta(transaction.date)}`}
                    amount={`${transaction.type === 'sale' ? '+' : '−'}${formatAmount(getTransactionAmount(transaction))}`}
                    type={transaction.type === 'sale' ? 'income' : 'expense'}
                    onClick={() => setSelectedTransaction(transaction)}
                  />
                ))}
              </div>

              {/* Tableau ordinateur */}
              <div className="hidden overflow-x-auto p-5 pt-3 lg:block">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                      <th className="px-2 py-2.5">Opération</th>
                      <th className="px-2 py-2.5">Type</th>
                      <th className="px-2 py-2.5">Date</th>
                      <th className="px-2 py-2.5 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        onClick={() => setSelectedTransaction(transaction)}
                        className="cursor-pointer border-t border-divider hover:bg-surface-soft"
                      >
                        <td className="px-2 py-3">
                          <span className="flex items-center gap-3">
                            <span
                              className={
                                transaction.type === 'sale'
                                  ? 'flex size-[38px] shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-xs font-bold text-brand-700'
                                  : 'flex size-[38px] shrink-0 items-center justify-center rounded-2xl bg-danger-bg text-xs font-bold text-danger-strong'
                              }
                            >
                              {transaction.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-semibold text-ink">{transaction.name}</span>
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={
                              transaction.type === 'sale'
                                ? 'rounded-full bg-success-bg px-2.5 py-1 text-xs font-bold text-success-strong'
                                : 'rounded-full bg-danger-bg px-2.5 py-1 text-xs font-bold text-danger-strong'
                            }
                          >
                            {transaction.type === 'sale' ? 'Vente' : 'Dépense'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-ink-3">{formatTransactionMeta(transaction.date)}</td>
                        <td
                          className={
                            transaction.type === 'sale'
                              ? 'whitespace-nowrap px-2 py-3 text-right font-bold text-success'
                              : 'whitespace-nowrap px-2 py-3 text-right font-bold text-danger'
                          }
                        >
                          {transaction.type === 'sale' ? '+' : '−'}
                          {formatAmount(getTransactionAmount(transaction))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {lowStockArticles.length > 0 ? (
          <Card className="hidden flex-[1_1_300px] flex-col gap-3 lg:flex">
            <CardHeader>
              <CardTitle>Stock faible</CardTitle>
              <span className="rounded-full bg-danger-bg px-2.5 py-1 text-xs font-bold text-danger-strong">
                {lowStockArticles.length} alerte{lowStockArticles.length > 1 ? 's' : ''}
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
                        {article.remaining_quantity} restants
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
              <Link href="/products">Voir le stock</Link>
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
