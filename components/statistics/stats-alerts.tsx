'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, TrendingDown, Calendar } from 'lucide-react'
import type { ApiTransaction } from '@/lib/services/transactions'
import dayjs from 'dayjs'
import { useCurrency } from '@/lib/utils/currency'

interface StatsAlertsProps {
  transactions: ApiTransaction[]
  isLoading: boolean
  dateFilter?: {
    start: Date | null
    end: Date | null
  }
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function StatsAlerts({ transactions, isLoading, dateFilter }: StatsAlertsProps) {
  const { currency } = useCurrency()
  const insights = useMemo(() => {
    // Filtrer par date si nécessaire
    let filteredTransactions = transactions
    if (dateFilter?.start || dateFilter?.end) {
      filteredTransactions = transactions.filter((t) => {
        const date = dayjs(t.created_at)
        if (dateFilter.start && date.isBefore(dateFilter.start, 'day')) return false
        if (dateFilter.end && date.isAfter(dateFilter.end, 'day')) return false
        return true
      })
    }

    // Produit le plus vendu
    const sales = filteredTransactions.filter((t) => t.type === 'sale')
    const productsMap: Record<string, number> = {}
    sales.forEach((t) => {
      if (t.article) {
        const name = t.article.name
        productsMap[name] = (productsMap[name] || 0) + (t.quantity || 0)
      }
    })
    const topProduct = Object.entries(productsMap)
      .sort(([, a], [, b]) => b - a)[0]

    // Dépense la plus élevée
    const expenses = filteredTransactions.filter((t) => t.type === 'expense')
    const topExpense = expenses
      .sort((a, b) => b.amount - a.amount)[0]

    // Jour avec le plus de ventes
    const salesByDate: Record<string, number> = {}
    sales.forEach((t) => {
      const date = dayjs(t.created_at).format('YYYY-MM-DD')
      salesByDate[date] = (salesByDate[date] || 0) + 1
    })
    const topDay = Object.entries(salesByDate)
      .sort(([, a], [, b]) => b - a)[0]

    return {
      topProduct: topProduct
        ? { name: topProduct[0], quantity: topProduct[1] }
        : null,
      topExpense: topExpense
        ? { name: topExpense.name, amount: topExpense.amount }
        : null,
      topDay: topDay
        ? { date: topDay[0], count: topDay[1] }
        : null,
    }
  }, [transactions, dateFilter])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl">
            <CardContent className="p-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Produit le plus vendu */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          <Alert>
            <Package className="h-4 w-4" />
            <AlertTitle>Produit le plus vendu</AlertTitle>
            <AlertDescription>
              {insights.topProduct ? (
                <>
                  <strong>{insights.topProduct.name}</strong>
                  <br />
                  {insights.topProduct.quantity} unité(s) vendue(s)
                </>
              ) : (
                'Aucune donnée disponible'
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Dépense la plus élevée */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          <Alert>
            <TrendingDown className="h-4 w-4" />
            <AlertTitle>Dépense la plus élevée</AlertTitle>
            <AlertDescription>
              {insights.topExpense ? (
                <>
                  <strong>{insights.topExpense.name}</strong>
                  <br />
                  {formatCurrency(insights.topExpense.amount)} {currency}
                </>
              ) : (
                'Aucune donnée disponible'
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Jour avec le plus de ventes */}
      <Card className="rounded-xl">
        <CardContent className="p-6">
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertTitle>Jour avec le plus de ventes</AlertTitle>
            <AlertDescription>
              {insights.topDay ? (
                <>
                  <strong>{dayjs(insights.topDay.date).format('DD MMMM YYYY')}</strong>
                  <br />
                  {insights.topDay.count} transaction(s)
                </>
              ) : (
                'Aucune donnée disponible'
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}

