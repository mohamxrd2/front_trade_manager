'use client'

import { TrendingUp } from 'lucide-react'
import {
  Card,
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
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts'
import type { CategoryAnalysisData } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useCurrency } from '@/lib/utils/currency'

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface CategoryChartsProps {
  data: CategoryAnalysisData | null
  isLoading: boolean
}

export function CategoryCharts({ data, isLoading }: CategoryChartsProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  
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

  // Configuration du graphique avec couleurs bleues (clair et foncé)
  const blueColors = [
    '#3b82f6', // Bleu foncé
    '#60a5fa', // Bleu moyen
    '#93c5fd', // Bleu clair
    '#3b82f6', // Bleu foncé (répétition)
    '#60a5fa', // Bleu moyen (répétition)
  ]

  const pieChartConfig: ChartConfig = data.sales_by_type.reduce((config, item, index) => {
    const typeKey = item.type.toLowerCase()
    config[typeKey] = {
      label: item.type,
      color: blueColors[index % blueColors.length],
    }
    return config
  }, {} as ChartConfig)

  // Préparer les données pour le PieChart avec les couleurs bleues
  const pieData = data.sales_by_type.map((item, index) => {
    return {
      type: item.type,
      total: item.total,
      percentage: item.percentage,
      fill: blueColors[index % blueColors.length], // Utiliser directement les couleurs bleues
    }
  })

  // Préparer les données pour le BarChart (Top 5)
  const topProducts = data.top_products.slice(0, 5)
  
  const barData = topProducts.map((product) => ({
    product: product.name,
    quantity: product.total_quantity,
    amount: product.total_amount,
  }))

  // Configuration du graphique avec couleur bleue
  const barChartConfig = {
    quantity: {
      label: t('analytics.topProductsDescription'),
      color: '#3b82f6', // Bleu
    },
  } satisfies ChartConfig

  // Calculer le total des quantités
  const totalQuantity = topProducts.reduce((sum, product) => sum + product.total_quantity, 0)
  const totalAmount = topProducts.reduce((sum, product) => sum + product.total_amount, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Graphique Répartition des ventes */}
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>{t('analytics.salesDistributionTitle')}</CardTitle>
          <CardDescription>
            {t('analytics.salesDistributionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          {pieData.length > 0 ? (
            <ChartContainer
              config={pieChartConfig}
              className="mx-auto aspect-square max-h-[300px]"
            >
              <PieChart>
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{data.type}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(data.total)} {currency} ({data.percentage.toFixed(1)}%)
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Pie data={pieData} dataKey="total" />
                <ChartLegend
                  content={<ChartLegendContent nameKey="type" />}
                  className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
                />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('analytics.noDataAvailable')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graphique Top 5 produits */}
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.topProductsTitle')}</CardTitle>
          <CardDescription>
            {t('analytics.topProductsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {barData.length > 0 ? (
            <ChartContainer config={barChartConfig}>
              <BarChart
                accessibilityLayer
                data={barData}
                layout="vertical"
                margin={{
                  left: 0,
                }}
              >
                <YAxis
                  dataKey="product"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  width={150}
                />
                <XAxis dataKey="quantity" type="number" hide />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar 
                  dataKey="quantity" 
                  layout="vertical" 
                  radius={5}
                  fill="var(--color-quantity)"
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              {t('analytics.noDataAvailable')}
            </div>
          )}
        </CardContent>
        {barData.length > 0 && (
          <CardFooter className="flex-col items-start gap-2 text-sm">
            <div className="flex gap-2 leading-none font-medium">
              {t('common.total')}: {totalQuantity} {t('analytics.totalUnitsSold')}
              {totalAmount > 0 && <TrendingUp className="h-4 w-4 text-green-600" />}
            </div>
            <div className="text-muted-foreground leading-none">
              {t('analytics.totalAmount')}: {formatCurrency(totalAmount)} {currency}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}

