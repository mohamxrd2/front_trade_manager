'use client'

import { FileText, DollarSign, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { InvoiceDashboardStats } from '@/lib/services/invoices'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface InvoiceDashboardCardsProps {
  stats: InvoiceDashboardStats | null
  isLoading: boolean
}

export function InvoiceDashboardCards({ stats, isLoading }: InvoiceDashboardCardsProps) {
  const { currency } = useCurrency()
  const { t } = useTranslation()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const cards = [
    {
      title: t('invoices.unpaidInvoices'),
      value: stats?.unpaid_count || 0,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      format: 'number',
    },
    {
      title: t('invoices.unpaidAmount'),
      value: stats?.unpaid_amount || 0,
      icon: DollarSign,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      format: 'currency',
    },
    {
      title: t('invoices.totalInvoices'),
      value: stats?.total_invoices || 0,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      format: 'number',
    },
    {
      title: t('invoices.totalCollected'),
      value: stats?.total_collected || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      format: 'currency',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">
                    {card.format === 'currency'
                      ? `${formatCurrency(card.value)} ${currency}`
                      : card.value}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

