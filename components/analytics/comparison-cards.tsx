'use client'

import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, DollarSign, ArrowUp, ArrowDown } from 'lucide-react'
import type { ComparisonsData } from '@/lib/services/analytics'
import { useCurrency } from '@/lib/utils/currency'

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface ComparisonCardsProps {
  data: ComparisonsData | null
  isLoading: boolean
}

export function ComparisonCards({ data, isLoading }: ComparisonCardsProps) {
  const { currency } = useCurrency()
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
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
      title: 'Ventes',
      data: data.sales,
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Dépenses',
      data: data.expenses,
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
    },
    {
      title: 'Revenu net',
      data: data.net_revenue,
      icon: DollarSign,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
  ]

  // Logger les données pour déboguer
  useEffect(() => {
    if (data) {
      console.log('📊 Données de comparaisons reçues dans ComparisonCards:', data)
    }
  }, [data])

  // Fonction helper pour formater les pourcentages de changement
  const formatPercentage = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00'
    }
    // Formater avec 2 décimales, le signe est géré par le backend
    return Math.abs(value).toFixed(2)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        const isIncrease = card.data.change_type === 'increase'
        // Gérer le cas où previous = 0
        const hasPreviousData = card.data.previous !== 0
        const changeValue = card.data.change ?? 0
        const changePercent = hasPreviousData 
          ? formatPercentage(changeValue)
          : card.data.current > 0 
          ? 'N/A' 
          : '0.00'

        return (
          <Card key={card.title} className="rounded-xl hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`${card.bgColor} ${card.color} p-3 rounded-full`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className={`flex items-center gap-1 ${
                    changePercent === 'N/A' 
                      ? 'text-muted-foreground' 
                      : isIncrease 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {changePercent !== 'N/A' && (
                      isIncrease ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )
                    )}
                    <span className="text-sm font-semibold">
                      {changePercent === 'N/A' 
                        ? 'N/A' 
                        : `${isIncrease ? '+' : '-'}${changePercent}%`}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(card.data.current)} {currency}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasPreviousData 
                      ? `Période précédente: ${formatCurrency(card.data.previous)} ${currency}`
                      : 'Aucune donnée pour la période précédente'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

