'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
} from 'recharts'
import type { TrendsData } from '@/lib/services/analytics'
import dayjs from 'dayjs'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useCurrency } from '@/lib/utils/currency'

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface TrendsChartsProps {
  data: TrendsData | null
  isLoading: boolean
}

export function TrendsCharts({ data, isLoading }: TrendsChartsProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [timeRange, setTimeRange] = useState(() => {
    // Initialiser avec '7d' sur mobile, sinon '90d'
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return '7d'
    }
    return '90d'
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="rounded-xl">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Préparer les données pour le graphique Ventes & Dépenses
  const allSalesExpensesData = data.sales_expenses
    ? (() => {
        const salesMap = new Map(
          data.sales_expenses.sales.map((item) => [item.date, item.amount])
        )
        const expensesMap = new Map(
          data.sales_expenses.expenses.map((item) => [item.date, item.amount])
        )
        const allDates = new Set([
          ...data.sales_expenses.sales.map((item) => item.date),
          ...data.sales_expenses.expenses.map((item) => item.date),
        ])
        return Array.from(allDates)
          .sort()
          .map((date) => ({
            date: date,
            dateFull: date,
            ventes: salesMap.get(date) || 0,
            depenses: expensesMap.get(date) || 0,
          }))
      })()
    : []

  // Filtrer les données selon la période sélectionnée (logique du chart-area-interactive)
  const salesExpensesData = allSalesExpensesData.filter((item) => {
    if (allSalesExpensesData.length === 0) return false
    
    const date = new Date(item.date)
    const referenceDate = new Date(allSalesExpensesData[allSalesExpensesData.length - 1].date)
    let daysToSubtract = 90
    if (timeRange === '30d') {
      daysToSubtract = 30
    } else if (timeRange === '7d') {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  // Configuration du graphique avec couleurs spécifiques
  const chartConfig = {
    ventes: {
      label: t('transactions.sale'),
      color: '#22c55e', // Vert
    },
    depenses: {
      label: t('transactions.expense'),
      color: '#ef4444', // Rouge
    },
  } satisfies ChartConfig

  // Calculer les totaux et variations
  const totalVentes = salesExpensesData.reduce((sum, item) => sum + item.ventes, 0)
  const totalDepenses = salesExpensesData.reduce((sum, item) => sum + item.depenses, 0)
  const netRevenue = totalVentes - totalDepenses
  const variation = salesExpensesData.length > 1
    ? ((salesExpensesData[salesExpensesData.length - 1].ventes - salesExpensesData[0].ventes) / salesExpensesData[0].ventes) * 100
    : 0

  // Dates pour le footer
  const firstDate = salesExpensesData.length > 0
    ? dayjs(salesExpensesData[0].dateFull).format('DD MMM YYYY')
    : ''
  const lastDate = salesExpensesData.length > 0
    ? dayjs(salesExpensesData[salesExpensesData.length - 1].dateFull).format('DD MMM YYYY')
    : ''

  // Préparer les données pour le graphique Wallet
  const walletData = data.wallet
    ? data.wallet.map((item) => ({
        date: dayjs(item.date).format('DD/MM'),
        dateFull: item.date,
        wallet: item.amount,
      }))
    : []

  // Configuration du graphique Wallet avec couleur bleue
  const walletChartConfig = {
    wallet: {
      label: t('wallet.title'),
      color: '#3b82f6', // Bleu
    },
  } satisfies ChartConfig

  // Calculer les variations pour le wallet
  const walletVariation = walletData.length > 1
    ? ((walletData[walletData.length - 1].wallet - walletData[0].wallet) / walletData[0].wallet) * 100
    : 0
  const walletFirstDate = walletData.length > 0
    ? dayjs(walletData[0].dateFull).format('DD MMM YYYY')
    : ''
  const walletLastDate = walletData.length > 0
    ? dayjs(walletData[walletData.length - 1].dateFull).format('DD MMM YYYY')
    : ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Graphique Ventes & Dépenses */}
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{t('analytics.salesExpensesTitle')}</CardTitle>
          <CardDescription>
            <span className="hidden @[540px]/card:block">
              {t('analytics.salesExpensesDescription')}
            </span>
            <span className="@[540px]/card:hidden">{t('analytics.salesExpensesDescriptionShort')}</span>
          </CardDescription>
          <CardAction>
            <ToggleGroup
              type="single"
              value={timeRange}
              onValueChange={setTimeRange}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            >
              <ToggleGroupItem value="90d">{t('analytics.last3Months')}</ToggleGroupItem>
              <ToggleGroupItem value="30d">{t('analytics.last30Days')}</ToggleGroupItem>
              <ToggleGroupItem value="7d">{t('analytics.last7Days')}</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                size="sm"
                aria-label={t('analytics.selectPeriod')}
              >
                <SelectValue placeholder={t('analytics.last3Months')} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="90d" className="rounded-lg">
                  {t('analytics.last3Months')}
                </SelectItem>
                <SelectItem value="30d" className="rounded-lg">
                  {t('analytics.last30Days')}
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  {t('analytics.last7Days')}
                </SelectItem>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          {salesExpensesData.length > 0 ? (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={salesExpensesData}>
                <defs>
                  <linearGradient id="fillVentes" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-ventes)"
                      stopOpacity={1.0}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-ventes)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillDepenses" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-depenses)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-depenses)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('fr-FR', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => {
                        return new Date(value).toLocaleDateString('fr-FR', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      }}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="ventes"
                  type="natural"
                  fill="url(#fillVentes)"
                  stroke="var(--color-ventes)"
                />
                <Area
                  dataKey="depenses"
                  type="natural"
                  fill="url(#fillDepenses)"
                  stroke="var(--color-depenses)"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              {t('analytics.noDataAvailable')}
            </div>
          )}
        </CardContent>
        {salesExpensesData.length > 0 && (
          <CardFooter>
            <div className="flex w-full items-start gap-2 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 leading-none font-medium">
                  {t('analytics.netRevenueLabel')}: {formatCurrency(netRevenue)} {currency}
                  {variation > 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 leading-none">
                  {firstDate} - {lastDate}
                </div>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>

      {/* Graphique Wallet */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.walletEvolutionTitle')}</CardTitle>
          <CardDescription>
            {t('analytics.walletEvolutionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {walletData.length > 0 ? (
            <ChartContainer config={walletChartConfig}>
              <AreaChart
                accessibilityLayer
                data={walletData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="wallet"
                  type="natural"
                  fill="var(--color-wallet)"
                  fillOpacity={0.4}
                  stroke="var(--color-wallet)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('analytics.noDataAvailable')}
            </div>
          )}
        </CardContent>
        {walletData.length > 0 && (
          <CardFooter>
            <div className="flex w-full items-start gap-2 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 leading-none font-medium">
                  {t('analytics.currentBalance')}: {formatCurrency(walletData[walletData.length - 1].wallet)} {currency}
                  {walletVariation > 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 leading-none">
                  {walletFirstDate} - {walletLastDate}
                </div>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}

