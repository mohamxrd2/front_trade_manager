'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { PredictionData } from '@/lib/services/analytics'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

dayjs.locale('fr')

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-'
  return dayjs(dateString).format('DD MMMM YYYY')
}

interface PredictionsTableProps {
  data: PredictionData[] | null
  isLoading: boolean
}

export function PredictionsTable({ data, isLoading }: PredictionsTableProps) {
  const { t } = useTranslation()
  
  if (isLoading) {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>{t('analytics.predictionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t('analytics.noPredictions')}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Trier par jours jusqu'à réapprovisionnement (plus urgent en premier)
  const sortedData = [...data].sort((a, b) => {
    if (a.status === 'out_of_stock' && b.status !== 'out_of_stock') return -1
    if (a.status !== 'out_of_stock' && b.status === 'out_of_stock') return 1
    return a.days_until_reorder - b.days_until_reorder
  })

  const getStatusBadge = (prediction: PredictionData) => {
    if (prediction.status === 'out_of_stock') {
      return (
        <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400">
          {t('analytics.predictionsTable.outOfStock')}
        </Badge>
      )
    }
    if (prediction.days_until_reorder < 7) {
      return (
        <Badge variant="outline" className="border-orange-500 text-orange-700 dark:text-orange-400">
          {t('analytics.predictionsTable.urgent')}
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
        {t('analytics.predictionsTable.inStock')}
      </Badge>
    )
  }

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>{t('analytics.predictionsTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('analytics.predictionsTable.article')}</TableHead>
                <TableHead>{t('analytics.predictionsTable.type')}</TableHead>
                <TableHead className="text-right">{t('analytics.predictionsTable.currentQuantity')}</TableHead>
                <TableHead className="text-right">{t('analytics.predictionsTable.soldQuantity')}</TableHead>
                <TableHead className="text-right">{t('analytics.predictionsTable.remainingQuantity')}</TableHead>
                <TableHead>{t('analytics.predictionsTable.soldPercentage')}</TableHead>
                <TableHead className="text-right">{t('analytics.predictionsTable.ratePerDay')}</TableHead>
                <TableHead>{t('analytics.predictionsTable.predictedDate')}</TableHead>
                <TableHead className="text-right">{t('analytics.predictionsTable.daysRemaining')}</TableHead>
                <TableHead>{t('analytics.predictionsTable.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((prediction) => (
                <TableRow key={prediction.article_id}>
                  <TableCell className="font-medium">{prediction.article_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{prediction.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{prediction.current_quantity}</TableCell>
                  <TableCell className="text-right">{prediction.sold_quantity}</TableCell>
                  <TableCell className="text-right">{prediction.remaining_quantity}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={prediction.sales_percentage} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {prediction.sales_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {prediction.sales_rate_per_day.toFixed(2)}
                  </TableCell>
                  <TableCell>{formatDate(prediction.predicted_reorder_date)}</TableCell>
                  <TableCell className="text-right">
                    {prediction.days_until_reorder > 0 ? (
                      <span className={prediction.days_until_reorder < 7 ? 'text-red-600 font-semibold' : ''}>
                        {prediction.days_until_reorder} {t('common.days')}
                      </span>
                    ) : prediction.days_until_reorder === 0 ? (
                      <span className="text-orange-600 font-semibold">{t('common.today')}</span>
                    ) : (
                      <span className="text-red-600 font-semibold">{t('analytics.predictionsTable.outOfStock')}</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(prediction)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

