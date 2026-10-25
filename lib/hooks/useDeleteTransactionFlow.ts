import { toast } from 'sonner'

import { useDeleteTransaction, useRestoreTransaction } from '@/lib/hooks/useDeleteTransaction'
import type { Transaction } from '@/lib/services/transactions'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/**
 * Orchestration partagée mobile/ordinateur : suppression optimiste puis
 * toast « Transaction supprimée » avec un bouton Annuler pendant 5 secondes
 * (restauration réelle côté serveur, voir POST /transactions/{id}/restore —
 * choix explicité au diagnostic : plus sûr qu'un envoi différé, qui perdrait
 * silencieusement la suppression si l'onglet se ferme pendant la fenêtre).
 * Un seul hook, utilisé identiquement par le geste de glissement mobile, le
 * bottom sheet mobile ET le dialog ordinateur — même confirmation, même
 * toast, partout.
 */
export function useDeleteTransactionFlow() {
  const { t } = useTranslation()
  const deleteMutation = useDeleteTransaction()
  const restoreMutation = useRestoreTransaction()

  const requestDelete = (transaction: Transaction) => {
    deleteMutation.mutate(transaction, {
      onSuccess: () => {
        toast.success(t('transactions.deleteFlow.deleted'), {
          duration: 5000,
          action: {
            label: t('transactions.deleteFlow.undo'),
            onClick: () => {
              restoreMutation.mutate(transaction, {
                onError: (error) => {
                  toast.error(error instanceof Error ? error.message : t('transactions.deleteFlow.restoreFailed'))
                },
              })
            },
          },
        })
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : t('transactions.deleteFlow.deleteFailed'))
      },
    })
  }

  return { requestDelete, isDeleting: deleteMutation.isPending }
}
