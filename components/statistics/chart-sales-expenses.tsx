'use client'

import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiTransaction } from '@/lib/services/transactions'
import dayjs from 'dayjs'
import { useCurrency } from '@/lib/utils/currency'

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface ChartSalesExpensesProps {
  transactions: ApiTransaction[]
  isLoading: boolean
  dateFilter?: {
    start: Date | null
    end: Date | null
  }
}

export function ChartSalesExpenses({ transactions, isLoading, dateFilter }: ChartSalesExpensesProps) {
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

    // Grouper par date
    const salesByDate: Record<string, number> = {}
    const expensesByDate: Record<string, number> = {}

    filteredTransactions.forEach((transaction) => {
      const date = dayjs(transaction.created_at).format('YYYY-MM-DD')
      
      if (transaction.type === 'sale') {
        salesByDate[date] = (salesByDate[date] || 0) + transaction.amount
      } else if (transaction.type === 'expense') {
        expensesByDate[date] = (expensesByDate[date] || 0) + transaction.amount
      }
    })

    // Créer la liste de toutes les dates
    const allDates = new Set([
      ...Object.keys(salesByDate),
      ...Object.keys(expensesByDate),
    ])
    const sortedDates = Array.from(allDates).sort()

    // Préparer les données
    const salesData = sortedDates.map((date) => salesByDate[date] || 0)
    const expensesData = sortedDates.map((date) => expensesByDate[date] || 0)

    return {
      labels: sortedDates.map((date) => dayjs(date).format('DD/MM')),
      datasets: [
        {
          label: 'Ventes',
          data: salesData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Dépenses',
          data: expensesData,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    }
  }, [transactions, dateFilter])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(context.parsed.y)} ${currency}`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value: any) {
            return new Intl.NumberFormat('fr-FR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value) + ` ${currency}`
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
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>Ventes vs Dépenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}

