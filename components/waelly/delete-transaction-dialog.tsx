'use client'

import * as React from 'react'

import type { Transaction } from '@/lib/services/transactions'
import { useDeletionConsequence } from '@/lib/hooks/useDeletionConsequence'
import { formatTransactionSummary } from '@/lib/transactions/transaction-summary'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'

interface DeleteTransactionDialogProps {
  transaction: Transaction | null
  onOpenChange: (open: boolean) => void
  onConfirm: (transaction: Transaction) => void
  confirming?: boolean
}

/**
 * Confirmation de suppression — partagée par le geste de glissement mobile,
 * le bottom sheet de détail (mobile) ET le dialog de détail (ordinateur) :
 * même titre, même résumé, même conséquence affichée, mêmes boutons
 * (Annuler/Supprimer, 44px minimum — déjà la hauteur par défaut d'AlertDialog).
 */
function DeleteTransactionDialog({ transaction, onOpenChange, onConfirm, confirming = false }: DeleteTransactionDialogProps) {
  const { t, language } = useTranslation()
  const consequence = useDeletionConsequence(transaction)
  const open = transaction !== null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {transaction?.type === 'expense' ? t('transactions.deleteDialog.titleExpense') : t('transactions.deleteDialog.titleSale')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {transaction ? formatTransactionSummary(transaction, language) : ''}
            <br />
            {consequence}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => transaction && onConfirm(transaction)}
            disabled={confirming}
          >
            {confirming ? t('products.detail.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { DeleteTransactionDialog }
export type { DeleteTransactionDialogProps }
