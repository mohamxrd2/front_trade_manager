'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, MoreHorizontal, Trash2, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import 'dayjs/locale/en'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoiceStatusBadge } from './invoice-status-badge'
import { deleteInvoice, type Invoice } from '@/lib/services/invoices'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { toast } from 'sonner'

interface InvoiceTableProps {
  invoices: Invoice[]
  isLoading: boolean
  onRefresh: () => void
}

function InvoiceTableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InvoiceTable({ invoices, isLoading, onRefresh }: InvoiceTableProps) {
  const router = useRouter()
  const { currency } = useCurrency()
  const { t, language } = useTranslation()

  // Les dates suivent la langue active (dayjs.locale mute l'instance globale)
  dayjs.locale(language)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleDelete = async () => {
    if (!invoiceToDelete) return

    setIsDeleting(true)
    try {
      // deleteInvoice() ne rejette jamais — elle retourne toujours
      // { success, message }, y compris sur échec (facture payée, 404...).
      // Il faut donc vérifier `result.success` explicitement : un simple
      // `await` + toast de succès inconditionnel (comme avant) affichait un
      // succès et rafraîchissait la liste même quand la suppression avait
      // réellement échoué côté serveur — la facture restait donc affichée,
      // ce qui donnait l'impression que le bouton ne faisait rien.
      const result = await deleteInvoice(invoiceToDelete.id)

      if (result.success) {
        toast.success(t('invoices.invoiceDeleted'))
        onRefresh()
      } else {
        toast.error(result.message || t('invoices.deleteError'))
      }
    } catch (error) {
      const err = error as Error
      toast.error(err.message || t('invoices.deleteError'))
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setInvoiceToDelete(null)
    }
  }

  if (isLoading) {
    return <InvoiceTableSkeleton />
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{t('invoices.noInvoices')}</p>
        <Button
          className="mt-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
          onClick={() => router.push('/invoices/new')}
        >
          {t('invoices.createFirst')}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invoices.number')}</TableHead>
              <TableHead>{t('invoices.client')}</TableHead>
              <TableHead>{t('invoices.date')}</TableHead>
              <TableHead>{t('invoices.pdf.status')}</TableHead>
              <TableHead className="text-right">{t('invoices.total')}</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/invoices/${invoice.id}`)}
              >
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.client?.name || '-'}</TableCell>
                <TableCell>{dayjs(invoice.issued_at).format('DD MMM YYYY')}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(Number(invoice.total))} {currency}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/invoices/${invoice.id}`)
                      }}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t('common.view')}
                      </DropdownMenuItem>
                      {/* Masqué pour les factures payées : le backend refuse
                          leur suppression (403 INVOICE_PAID, raisons comptables). */}
                      {invoice.status !== 'paid' && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setInvoiceToDelete(invoice)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('invoices.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('invoices.deleteConfirmDescription', { number: invoiceToDelete?.invoice_number ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

