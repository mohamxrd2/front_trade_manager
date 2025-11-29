'use client'

import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiTransaction } from '@/lib/services/transactions'
import dayjs from 'dayjs'

// Enregistrer les composants Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface ChartTopProductsProps {
  transactions: ApiTransaction[]
  isLoading: boolean
  dateFilter?: {
    start: Date | null
    end: Date | null
  }
  limit?: number
}

export function ChartTopProducts({ 
  transactions, 
  isLoading, 
  dateFilter,
  limit = 10 
}: ChartTopProductsProps) {
  const chartData = useMemo(() => {
    if (!transactions.length) {
      return {
        labels: [],
        datasets: [],
      }
    }

    // Filtrer par date si nécessaire
    let filteredTransactions = transactions.filter((t) => t.type === 'sale')
    if (dateFilter?.start || dateFilter?.end) {
      filteredTransactions = filteredTransactions.filter((t) => {
        const date = dayjs(t.created_at)
        if (dateFilter.start && date.isBefore(dateFilter.start, 'day')) return false
        if (dateFilter.end && date.isAfter(dateFilter.end, 'day')) return false
        return true
      })
    }

    // Grouper par article
    const productsMap: Record<string, number> = {}

    filteredTransactions.forEach((transaction) => {
      if (transaction.type === 'sale' && transaction.article) {
        const productName = transaction.article.name
        const quantity = transaction.quantity || 0
        productsMap[productName] = (productsMap[productName] || 0) + quantity
      }
    })

    // Trier et limiter
    const sortedProducts = Object.entries(productsMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)

    return {
      labels: sortedProducts.map(([name]) => name),
      datasets: [
        {
          label: 'Quantité vendue',
          data: sortedProducts.map(([, quantity]) => quantity),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
      ],
    }
  }, [transactions, dateFilter, limit])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `Quantité: ${context.parsed.y}`
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
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
        <CardTitle>Top {limit} Produits les Plus Vendus</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}

