'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

// ============================================================================
// CONFIGURATION REACT QUERY OPTIMISÉE POUR LE CACHE
// ============================================================================

/**
 * Configuration par défaut des queries
 * 
 * staleTime: 5 minutes - Les données sont considérées fraîches pendant 5 min
 *   → La barre de progression ne s'affiche PAS si on revisite une page dans ce délai
 * 
 * gcTime (anciennement cacheTime): 30 minutes - Les données restent en cache 30 min
 *   → Même après être "stale", les données sont servies du cache pendant le refetch
 * 
 * refetchOnWindowFocus: false - Pas de refetch automatique au focus
 *   → Évite les requêtes inutiles et les flashs de loader
 * 
 * refetchOnMount: false quand stale - Pas de refetch si données en cache valides
 *   → Navigation instantanée entre pages déjà visitées
 */
const QUERY_CONFIG = {
  // Durée pendant laquelle les données sont considérées "fraîches"
  // Pendant cette période, AUCUNE requête n'est faite → pas de barre de progression
  staleTime: 5 * 60 * 1000, // 5 minutes

  // Durée de conservation en cache après que les données soient "stale"
  // Les données sont servies immédiatement du cache pendant le background refetch
  gcTime: 30 * 60 * 1000, // 30 minutes (anciennement cacheTime)

  // Pas de refetch automatique au focus de la fenêtre
  refetchOnWindowFocus: false,

  // Refetch seulement si les données sont stale
  refetchOnMount: 'always' as const, // true | false | 'always'

  // Pas de refetch en arrière-plan quand on reconnecte
  refetchOnReconnect: false,

  // Nombre de retries en cas d'erreur
  retry: 1,

  // Délai entre les retries
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
}

/**
 * Provider TanStack Query optimisé pour une UX fluide
 * 
 * Comportement attendu :
 * - ✅ Navigation instantanée vers pages déjà visitées (cache hit)
 * - ✅ Barre de progression uniquement quand données non en cache
 * - ✅ Background refetch silencieux après staleTime
 * - ✅ Pas de flash de loader inutile
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: QUERY_CONFIG,
          mutations: {
            // Les mutations invalident le cache → déclenche refetch → affiche la barre
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Export du QueryClient pour utilisation dans les hooks personnalisés
export { QUERY_CONFIG }
