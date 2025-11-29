'use client'

import { useMemo } from 'react'
import { Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiTransaction } from '@/lib/services/transactions'
import dayjs from 'dayjs'
import { useCurrency } from '@/lib/utils/currency'

// Enregistrer les composants Chart.js
ChartJS.register(ArcElement, Tooltip, Legend)

interface ChartTransactionsPieProps {
  transactions: ApiTransaction[]
  isLoading: boolean
  dateFilter?: {
    start: Date | null
    end: Date | null
  }
}

export function ChartTransactionsPie({ transactions, isLoading, dateFilter }: ChartTransactionsPieProps) {
  const { currency } = useCurrency()
  const chartData = useMemo(() => {
    if (!transactions.length) {
      return {
        labels: [],
        datasets: [],
      }
    }

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

    // Calculer les totaux
    const salesTotal = filteredTransactions
      .filter((t) => t.type === 'sale')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const expensesTotal = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const total = salesTotal + expensesTotal

    return {
      labels: ['Ventes', 'Dépenses'],
      datasets: [
        {
          data: [salesTotal, expensesTotal],
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(239, 68, 68, 0.8)',
          ],
          borderColor: [
            'rgb(34, 197, 94)',
            'rgb(239, 68, 68)',
          ],
          borderWidth: 2,
        },
      ],
    }
  }, [transactions, dateFilter])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || ''
            const value = context.parsed || 0
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
            return `${label}: ${new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value)} ${currency} (${percentage}%)`
          },
        },
      },
    },
  }

  if (isLoading) {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>Répartition des Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Pie data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}

