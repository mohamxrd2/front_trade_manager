import { useQuery } from '@tanstack/react-query'

import { keys } from '@/lib/query-keys'
import { getTransactions } from '@/lib/services/transactions'

/**
 * Source UNIQUE de la liste des transactions (Portefeuille, Accueil « Dernières
 * opérations »). Avant, chaque écran la refetchait dans son propre état local
 * (ou sa propre clé TanStack Query) : une suppression sur l'un ne se
 * répercutait jamais sur l'autre sans rechargement complet de la page.
 */
export function useTransactionsQuery() {
  return useQuery({
    queryKey: keys.transactions.list(),
    queryFn: getTransactions,
  })
}
