'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { TransactionsResponse } from '@/lib/services/analytics'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCurrency } from '@/lib/utils/currency'

dayjs.locale('fr')

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (dateString: string): string => {
  return dayjs(dateString).format('DD MMM YYYY')
}

interface TransactionsTableProps {
  data: TransactionsResponse | null
  isLoading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  transactionType: string | null
  onTransactionTypeChange: (type: string | null) => void
  currentPage: number
  onPageChange: (page: number) => void
}

export function TransactionsTable({
  data,
  isLoading,
  searchQuery,
  onSearchChange,
  transactionType,
  onTransactionTypeChange,
  currentPage,
  onPageChange,
}: TransactionsTableProps) {
  const { currency } = useCurrency()
  const pagination = data?.pagination

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
        <CardTitle>Transactions Détaillées</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Rechercher par nom..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={transactionType || 'all'}
            onValueChange={(value) => onTransactionTypeChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="sale">Vente</SelectItem>
              <SelectItem value="expense">Dépense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tableau */}
        {data && data.transactions.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Nom/Type</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        {transaction.article?.name || transaction.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            transaction.type === 'sale'
                              ? 'border-green-500 text-green-700 dark:text-green-400'
                              : 'border-red-500 text-red-700 dark:text-red-400'
                          }
                        >
                          {transaction.type === 'sale' ? 'Vente' : 'Dépense'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(transaction.amount)} {currency}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.last_page > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.current_page} sur {pagination.last_page} ({pagination.total} résultats)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === pagination.last_page}
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucune transaction trouvée
          </div>
        )}
      </CardContent>
    </Card>
  )
}

