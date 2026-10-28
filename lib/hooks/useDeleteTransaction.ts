import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { keys } from '@/lib/query-keys'
import type { Transaction } from '@/lib/services/transactions'
import { deleteOperation, restoreOperation, type Operation } from '@/lib/services/operations'

interface TransactionListContext {
  previous: Transaction[] | undefined
}

/**
 * Invalide tout ce qui dépend du résultat d'une transaction (vente ou
 * dépense) : totaux/solde, analyses, tableau de bord, et — si c'est une
 * vente — le stock de l'article/variation concerné. Partagé entre
 * suppression ET restauration : les deux changent exactement les mêmes
 * agrégats, juste dans des sens opposés.
 */
function invalidateTransactionSideEffects(queryClient: QueryClient, transaction: Transaction) {
  void queryClient.invalidateQueries({ queryKey: keys.transactions.all })
  void queryClient.invalidateQueries({ queryKey: keys.userStats.all })
  void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
  void queryClient.invalidateQueries({ queryKey: keys.analytics.all })
  void queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
  void queryClient.invalidateQueries({ queryKey: keys.wallet.all })

  if (transaction.article_id) {
    void queryClient.invalidateQueries({ queryKey: keys.products.list() })
    void queryClient.invalidateQueries({ queryKey: keys.products.detail(transaction.article_id) })
  }
}

/**
 * Fabrique les options de useMutation à partir d'un QueryClient — séparée du
 * hook React pour être testable directement (new QueryClient() + appel
 * manuel de onMutate/onError), sans jsdom ni @testing-library/react.
 */
export function createDeleteTransactionMutationOptions(queryClient: QueryClient) {
  return {
    // Étape 3 du chantier "paniers multi-articles" : TOUTE suppression passe
    // désormais par l'opération (DELETE /api/operations/{id}), jamais par la
    // ligne seule — une transaction isolée appartient toujours à UNE
    // opération (même à une seule ligne, depuis le backfill), et c'est
    // l'opération qui porte la règle "pas de suppression partielle d'un
    // panier à plusieurs lignes" côté serveur. `operation_id` est toujours
    // présent ; le repli sur `transaction.id` ne sert qu'à ne jamais planter
    // sur une donnée antérieure au backfill qui aurait échappé à la migration.
    mutationFn: (transaction: Transaction) => deleteOperation(transaction.operation_id ?? transaction.id),

    onMutate: async (transaction: Transaction): Promise<TransactionListContext> => {
      await queryClient.cancelQueries({ queryKey: keys.transactions.list() })
      const previous = queryClient.getQueryData<Transaction[]>(keys.transactions.list())

      queryClient.setQueryData<Transaction[]>(keys.transactions.list(), (old = []) =>
        old.filter((t) => t.id !== transaction.id)
      )

      return { previous }
    },

    onError: (_error: unknown, _transaction: Transaction, context?: TransactionListContext) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.transactions.list(), context.previous)
      }
    },

    onSuccess: (_data: void, transaction: Transaction) => {
      invalidateTransactionSideEffects(queryClient, transaction)
    },
  }
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation(createDeleteTransactionMutationOptions(queryClient))
}

/**
 * Restauration (bouton « Annuler » du toast post-suppression). Même
 * principe : insertion optimiste en tête de liste, retour en arrière si le
 * serveur refuse (ex. fenêtre de restauration déjà fermée côté serveur).
 */
export function createRestoreTransactionMutationOptions(queryClient: QueryClient) {
  return {
    mutationFn: (transaction: Transaction) => restoreOperation(transaction.operation_id ?? transaction.id),

    onMutate: async (transaction: Transaction): Promise<TransactionListContext> => {
      await queryClient.cancelQueries({ queryKey: keys.transactions.list() })
      const previous = queryClient.getQueryData<Transaction[]>(keys.transactions.list())

      queryClient.setQueryData<Transaction[]>(keys.transactions.list(), (old = []) => [transaction, ...old])

      return { previous }
    },

    onError: (_error: unknown, _transaction: Transaction, context?: TransactionListContext) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.transactions.list(), context.previous)
      }
    },

    // Le serveur renvoie l'Operation restaurée (pas une Transaction) — les
    // effets de bord n'ont besoin que de l'article_id, déjà connu AVANT
    // l'appel (voir `transaction`, l'objet passé à .mutate() ci-dessous),
    // inutile d'attendre/mapper la réponse serveur pour ça.
    onSuccess: (_restored: Operation, transaction: Transaction) => {
      invalidateTransactionSideEffects(queryClient, transaction)
    },
  }
}

export function useRestoreTransaction() {
  const queryClient = useQueryClient()
  return useMutation(createRestoreTransactionMutationOptions(queryClient))
}
