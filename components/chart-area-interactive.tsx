"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { getAnalyticsTrends } from "@/lib/services/analytics"
import type { TrendsData } from "@/lib/services/analytics"

export const description = "An interactive area chart for sales and expenses"

// chartConfig sera défini dans le composant pour utiliser les traductions

interface ChartAreaInteractiveProps {
  data?: TrendsData | null
  isLoading?: boolean
}

export function ChartAreaInteractive({ data: propData = null, isLoading: propIsLoading = false }: ChartAreaInteractiveProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  const chartConfig = {
    ventes: {
      label: t('transactions.sale'),
      color: "#22c55e", // Vert
    },
    depenses: {
      label: t('transactions.expense'),
      color: "#ef4444", // Rouge
    },
  } satisfies ChartConfig

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  // Récupérer les données si elles ne sont pas fournies en props
  const {
    data: fetchedData,
    isLoading: isFetching,
  } = useQuery({
    queryKey: ['analytics-trends-dashboard', { period: '30' }],
    queryFn: () => getAnalyticsTrends({ period: '30', type: 'both' }),
    enabled: !propData, // Ne récupérer que si les données ne sont pas fournies
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  // Utiliser les données des props ou celles récupérées
  const data = propData ?? fetchedData ?? null
  const isLoading = propIsLoading || (isFetching && !propData)

  // Préparer les données pour le graphique Ventes & Dépenses
  const allSalesExpensesData = React.useMemo(() => {
    if (!data?.sales_expenses) return []
    
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
        ventes: salesMap.get(date) || 0,
        depenses: expensesMap.get(date) || 0,
      }))
  }, [data])

  // Filtrer les données selon la période sélectionnée
  const filteredData = React.useMemo(() => {
    if (allSalesExpensesData.length === 0) return []
    
    const referenceDate = new Date(allSalesExpensesData[allSalesExpensesData.length - 1].date)
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    
    return allSalesExpensesData.filter((item) => {
      const date = new Date(item.date)
      return date >= startDate
    })
  }, [allSalesExpensesData, timeRange])

  // Afficher le skeleton seulement si isLoading est vrai
  if (isLoading) {
    return (
      <Card className="@container/card">
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[250px] w-full bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t('chart.totalSalesAndExpenses')}</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {t('chart.totalSalesAndExpensesDescription')}
          </span>
          <span className="@[540px]/card:hidden">{t('chart.totalSalesAndExpensesShort')}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">{t('chart.last3Months')}</ToggleGroupItem>
            <ToggleGroupItem value="30d">{t('chart.last30Days')}</ToggleGroupItem>
            <ToggleGroupItem value="7d">{t('chart.last7Days')}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label={t('chart.selectPeriod')}
            >
              <SelectValue placeholder={t('chart.last3Months')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                {t('chart.last3Months')}
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                {t('chart.last30Days')}
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                {t('chart.last7Days')}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[250px] w-full"
          >
            <AreaChart data={filteredData}>
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
                  return date.toLocaleDateString("fr-FR", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("fr-FR", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
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
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            {t('common.noData')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
