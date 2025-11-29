'use client'

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OverviewData, ComparisonsData } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useCurrency } from '@/lib/utils/currency'

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Fonction helper pour formater les pourcentages de changement
const formatPercentage = (
  change: number | null | undefined,
  previous: number | null | undefined,
  current: number | null | undefined
): { value: string; isNew: boolean } => {
  // Si change est null/undefined ou NaN
  if (change === null || change === undefined || isNaN(change)) {
    return { value: '0.00', isNew: false }
  }

  // Si previous = 0 et current > 0 ET que change est très grand (infini), c'est une nouvelle donnée
  // Mais seulement si change est vraiment infini ou très grand
  // Si change est un nombre normal, utiliser le calcul normal même si previous = 0
  if (previous === 0 && current !== null && current !== undefined && current > 0) {
    // Si change est très grand (infini), afficher "Nouveau"
    if (Math.abs(change) > 10000 || !isFinite(change)) {
      // Note: "Nouveau" sera traduit dans le composant
      return { value: 'NEW', isNew: true }
    }
    // Sinon, même si previous = 0, utiliser le pourcentage calculé par le backend
    // Le backend peut calculer un pourcentage même avec previous = 0
  }

  // Formatage normal avec 2 décimales
  return { value: Math.abs(change).toFixed(2), isNew: false }
}

interface OverviewCardsProps {
  data: OverviewData | null
  comparisons: ComparisonsData | null
  isLoading: boolean
}

export function OverviewCards({ data, comparisons, isLoading }: OverviewCardsProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  
  if (isLoading) {
    return (
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
        {[1, 2, 3].map((i) => (
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

  const cards = [
    {
      title: t('analytics.netRevenue'),
      value: data.net_revenue,
      icon: DollarSign,
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      iconBgHover: 'group-hover:bg-primary/20',
      description: t('analytics.netRevenueDescription'),
      comparison: comparisons?.net_revenue,
    },
    {
      title: t('analytics.totalSales'),
      value: data.total_sales,
      icon: TrendingUp,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
      iconBgHover: 'group-hover:bg-green-500/20',
      description: t('analytics.totalSalesDescription'),
      comparison: comparisons?.sales,
    },
    {
      title: t('analytics.totalExpenses'),
      value: data.total_expenses,
      icon: TrendingDown,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
      iconBgHover: 'group-hover:bg-red-500/20',
      description: t('analytics.totalExpensesDescription'),
      comparison: comparisons?.expenses,
    },
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        const comparison = card.comparison
        
        // Normaliser les données avec des valeurs par défaut
        const normalizedComparison = comparison ? {
          current: comparison.current ?? 0,
          previous: comparison.previous ?? 0,
          change: comparison.change ?? 0,
          change_type: comparison.change_type ?? 'neutral' as 'increase' | 'decrease' | 'neutral',
        } : null
        
        // Logger pour déboguer
        if (normalizedComparison) {
          console.log(`📊 Comparaison ${card.title}:`, normalizedComparison)
        }
        
        const hasComparison = normalizedComparison !== null
        const isIncrease = normalizedComparison?.change_type === 'increase'
        
        // Formater le pourcentage de changement
        const { value: changePercent, isNew } = hasComparison && normalizedComparison
          ? formatPercentage(
              normalizedComparison.change,
              normalizedComparison.previous,
              normalizedComparison.current
            )
          : { value: null, isNew: false }

        return (
          <Card
            key={card.title}
            className="@container/card group hover:shadow-md transition-shadow"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center transition-colors',
                  card.iconBg,
                  card.iconBgHover
                )}
              >
                <Icon className={cn('h-4 w-4', card.iconColor)} />
              </div>
            </CardHeader>
            <CardHeader className="pt-1">
              <div className="flex items-baseline gap-2">
                <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
                  {formatCurrency(card.value)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">{currency}</span>
                </CardTitle>
                {hasComparison && changePercent !== null && (
                  <div
                    className={cn(
                      'flex items-center gap-0.5 text-xs font-semibold',
                      isNew
                        ? 'text-blue-600 dark:text-blue-400'
                        : changePercent === '0.00'
                        ? 'text-muted-foreground' 
                        : isIncrease 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {!isNew && changePercent !== '0.00' && (
                      isIncrease ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    )}
                    <span>
                      {isNew 
                        ? t('analytics.new')
                        : `${isIncrease ? '+' : '-'}${changePercent}%`}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardFooter className="flex-col items-start pt-1">
              <CardDescription className="text-xs">{card.description}</CardDescription>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

