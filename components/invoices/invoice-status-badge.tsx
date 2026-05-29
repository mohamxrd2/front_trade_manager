'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/lib/services/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
  className?: string
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const { t } = useTranslation()

  const config: Record<InvoiceStatus, { label: string; classes: string }> = {
    draft: {
      label: t('invoices.status.draft'),
      classes: 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    },
    unpaid: {
      label: t('invoices.status.unpaid'),
      classes: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    },
    paid: {
      label: t('invoices.status.paid'),
      classes: 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    cancelled: {
      label: t('invoices.status.cancelled'),
      classes: 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
    },
    overdue: {
      label: t('invoices.status.overdue'),
      classes: 'border-red-400 bg-red-100 text-red-800 dark:border-red-600 dark:bg-red-900/50 dark:text-red-200',
    },
  }

  const { label, classes } = config[status] || config.draft

  return (
    <Badge variant="outline" className={cn('font-medium', classes, className)}>
      {label}
    </Badge>
  )
}

