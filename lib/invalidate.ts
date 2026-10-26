import { queryClient } from './query-client'
import { keys } from './query-keys'

/**
 * Petits helpers d'invalidation partagés pour les pages qui ne sont pas
 * (encore) migrées sur TanStack Query pour leur propre liste (Factures,
 * Clients — fetch manuel useState/useEffect), mais dont les mutations
 * doivent quand même invalider le cache des AUTRES pages qui, elles, lisent
 * ces données via `lib/query-keys.ts`.
 *
 * Toujours des clés précises (jamais `invalidateQueries()` sans queryKey).
 */

/**
 * Facture créée/dupliquée/supprimée, ou changement de statut.
 * `paid: true` uniquement quand le nouveau statut est "paid" : une facture
 * payée touche aussi le portefeuille, les clients et peut déclencher une
 * notification, contrairement à un simple changement de brouillon → envoyée.
 */
export function invalidateInvoices(options?: { paid?: boolean }) {
  queryClient.invalidateQueries({ queryKey: keys.invoices.all })
  queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
  if (options?.paid) {
    queryClient.invalidateQueries({ queryKey: keys.clients.all })
    queryClient.invalidateQueries({ queryKey: keys.wallet.all })
    // Une facture payée crée une transaction de vente — même clé que
    // lib/hooks/useTransactions.ts, sans quoi /wallet ne l'affiche qu'au
    // prochain refetch naturel.
    queryClient.invalidateQueries({ queryKey: keys.transactions.all })
    queryClient.invalidateQueries({ queryKey: keys.analytics.all })
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('notification-updated'))
  }
}

/** Client créé/modifié/supprimé. */
export function invalidateClients() {
  queryClient.invalidateQueries({ queryKey: keys.clients.all })
}
