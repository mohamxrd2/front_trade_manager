import { useArticles } from '@/lib/hooks/useArticles'
import type { Transaction } from '@/lib/services/transactions'
import { describeDeletionConsequence } from '@/lib/transactions/transaction-summary'

/**
 * Résout, à partir du cache articles déjà chargé (pas de requête dédiée),
 * la quantité restante actuelle de l'article/variation visé par CETTE
 * vente, puis y rajoute sa propre quantité (la supprimer retire cette
 * quantité de la somme des ventes, donc le stock remonte exactement d'autant
 * — voir TransactionController::destroy()). `null` si l'article a depuis
 * été supprimé : describeDeletionConsequence retombe alors sur une
 * formulation générique plutôt que d'afficher un chiffre inventé.
 */
export function useDeletionConsequence(transaction: Transaction | null): string {
  const { articles } = useArticles()

  if (!transaction) return ''
  if (transaction.type === 'expense') {
    return describeDeletionConsequence(transaction, null)
  }

  const article = articles.find((a) => String(a.id) === String(transaction.article_id))
  if (!article) {
    return describeDeletionConsequence(transaction, null)
  }

  const quantity = transaction.quantity ?? 0

  if (transaction.variable_id) {
    const variation = article.variations?.find((v) => v.id === transaction.variable_id)
    if (!variation) return describeDeletionConsequence(transaction, null)
    return describeDeletionConsequence(transaction, variation.remaining_quantity + quantity)
  }

  return describeDeletionConsequence(transaction, article.remaining_quantity + quantity)
}
