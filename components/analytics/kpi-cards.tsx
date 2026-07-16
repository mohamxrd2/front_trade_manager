'use client'

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Percent, ShoppingCart, Calendar, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KPIsData } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useCurrency } from '@/lib/utils/currency'

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface KPICardsProps {
  data: KPIsData | null
  isLoading: boolean
}

export function KPICards({ data, isLoading }: KPICardsProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  
  if (isLoading) {
    return (
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardHeader className="pt-1">
              <Skeleton className="h-8 w-32" />
            </CardHeader>
            <CardFooter className="flex-col items-start pt-1">
              <Skeleton className="h-3 w-40" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return null
  }

  const kpis = [
    {
      title: t('analytics.netMargin'),
      value: `${data.net_margin.toFixed(2)}%`,
      icon: Percent,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      iconBgHover: 'group-hover:bg-blue-500/20',
      description: t('analytics.netMarginDescription'),
    },
    {
      title: t('analytics.averageBasket'),
      value: formatCurrency(data.average_basket),
      valueSuffix: currency,
      icon: ShoppingCart,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
      iconBgHover: 'group-hover:bg-green-500/20',
      description: t('analytics.averageBasketDescription'),
    },
    {
      title: t('analytics.averageSalesPerDay'),
      value: formatCurrency(data.average_sales_per_day),
      valueSuffix: currency,
      icon: Calendar,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10',
      iconBgHover: 'group-hover:bg-purple-500/20',
      description: t('analytics.averageSalesPerDayDescription'),
    },
    {
      title: t('analytics.expenseRate'),
      value: `${data.expense_rate.toFixed(2)}%`,
      icon: TrendingDown,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
      iconBgHover: 'group-hover:bg-orange-500/20',
      description: t('analytics.expenseRateDescription'),
    },
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card
            key={kpi.title}
            className="@container/card group hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                  kpi.iconBg,
                  kpi.iconBgHover
                )}
              >
                <Icon className={cn('h-4 w-4', kpi.iconColor)} />
              </div>
            </CardHeader>
            <CardHeader className="pt-1">
              <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                {kpi.value}{' '}
                {kpi.valueSuffix && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {kpi.valueSuffix}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start pt-1">
              <CardDescription className="text-xs">{kpi.description}</CardDescription>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

