'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteInvoice } from '@/lib/services/invoices'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface DeleteInvoiceButtonProps {
  invoiceId: string
  invoiceNumber: string
  status: string
  onDeleted?: () => void
}

export function DeleteInvoiceButton({ 
  invoiceId, 
  invoiceNumber, 
  status, 
  onDeleted 
}: DeleteInvoiceButtonProps) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { t } = useTranslation()

  // ⚠️ Ne pas afficher le bouton si la facture est payée
  if (status === 'paid') {
    return null
  }

  const handleDelete = async () => {
    setLoading(true)
    
    const result = await deleteInvoice(invoiceId)
    
    if (result.success) {
      toast.success(`Facture ${invoiceNumber} supprimée`)
      setOpen(false)
      
      if (onDeleted) {
        onDeleted()
      } else {
        router.push('/invoices')
      }
    } else {
      toast.error(result.message)
    }
    
    setLoading(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="w-4 h-4 mr-2" />
          {t('common.delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('invoices.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('invoices.deleteDescription')} <strong>{invoiceNumber}</strong> ?
            <br />
            <span className="text-destructive">{t('invoices.deleteWarning')}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('common.deleting')}
              </>
            ) : (
              t('common.delete')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

