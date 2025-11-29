'use client'

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { ApiTransaction } from '@/lib/services/transactions'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { useCurrency } from '@/lib/utils/currency'

dayjs.locale('fr')

interface StatsTableProps {
  transactions: ApiTransaction[]
  isLoading: boolean
  dateFilter?: {
    start: Date | null
    end: Date | null
  }
  typeFilter?: 'all' | 'sale' | 'expense'
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (dateString: string): string => {
  return dayjs(dateString).format('DD MMMM YYYY')
}

export function StatsTable({ transactions, isLoading, dateFilter, typeFilter }: StatsTableProps) {
  const { currency } = useCurrency()
  const tableData = useMemo(() => {
    // Filtrer les transactions
    let filtered = transactions.filter((t) => t.type === 'sale')

    if (dateFilter?.start || dateFilter?.end) {
      filtered = filtered.filter((t) => {
        const date = dayjs(t.created_at)
        if (dateFilter.start && date.isBefore(dateFilter.start, 'day')) return false
        if (dateFilter.end && date.isAfter(dateFilter.end, 'day')) return false
        return true
      })
    }

    if (typeFilter && typeFilter !== 'all') {
      filtered = filtered.filter((t) => t.type === typeFilter)
    }

    // Grouper par produit
    const productsMap: Record<
      string,
      {
        name: string
        totalQuantity: number
        totalAmount: number
        lastSale: string
        variation: string | null
      }
    > = {}

    filtered.forEach((transaction) => {
      if (transaction.article) {
        const productName = transaction.article.name
        const variationName = transaction.variation?.name || null

        if (!productsMap[productName]) {
          productsMap[productName] = {
            name: productName,
            totalQuantity: 0,
            totalAmount: 0,
            lastSale: transaction.created_at,
            variation: variationName,
          }
        }

        productsMap[productName].totalQuantity += transaction.quantity || 0
        productsMap[productName].totalAmount += transaction.amount
        if (dayjs(transaction.created_at).isAfter(dayjs(productsMap[productName].lastSale))) {
          productsMap[productName].lastSale = transaction.created_at
          productsMap[productName].variation = variationName
        }
      }
    })

    return Object.values(productsMap).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [transactions, dateFilter, typeFilter])

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

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle>Statistiques Détaillées par Produit</CardTitle>
      </CardHeader>
      <CardContent>
        {tableData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Aucune donnée disponible
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">Quantité vendue</TableHead>
                  <TableHead className="text-right">Montant total</TableHead>
                  <TableHead>Dernière vente</TableHead>
                  <TableHead>Variation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{product.totalQuantity}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(product.totalAmount)} {currency}
                    </TableCell>
                    <TableCell>{formatDate(product.lastSale)}</TableCell>
                    <TableCell>
                      {product.variation ? (
                        <Badge variant="outline">{product.variation}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

