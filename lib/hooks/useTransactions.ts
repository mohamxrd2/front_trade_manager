import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { keys } from '@/lib/query-keys'
import { getTransactions, searchTransactions, type TransactionSearchParams } from '@/lib/services/transactions'

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

/**
 * Recherche/filtre paginée (barre de recherche Portefeuille) —
 * `placeholderData: keepPreviousData` : la liste affichée reste celle de la
 * recherche précédente pendant qu'une nouvelle page/requête charge, pas de
 * clignotement ni de vidage de liste entre deux frappes.
 */
export function useTransactionsSearchQuery(params: TransactionSearchParams) {
  return useQuery({
    queryKey: keys.transactions.search(params),
    queryFn: () => searchTransactions(params),
    placeholderData: keepPreviousData,
  })
}
