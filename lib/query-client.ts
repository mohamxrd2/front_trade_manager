import { QueryClient } from '@tanstack/react-query'

/**
 * Instance UNIQUE du QueryClient, au niveau module (pas dans un composant) :
 * - `app/providers.tsx` la fournit à `<PersistQueryClientProvider>`.
 * - `lib/hooks/useCache.ts` (invalidateArticles, invalidateUserStats…) s'en
 *   sert directement, hors contexte React, exactement comme avant avec
 *   `swrMutate` — sans ça, ces fonctions ne pourraient pas invalider le
 *   cache depuis un simple gestionnaire d'événement.
 *
 * `staleTime`/`gcTime` par défaut couvrent les données « normales » (stock,
 * clients, factures, collaborateurs — 5 min). Notifications (30 s),
 * Dashboard/Portefeuille (1 min) et Paramètres (30 min) surchargent ce
 * défaut directement dans leur `useQuery`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
      placeholderData: (previousData: unknown) => previousData,
      structuralSharing: true,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Clé localStorage du cache persistant (voir app/providers.tsx,
// PersistQueryClientProvider) et clé où l'on retient QUEL utilisateur ce
// cache représente.
const PERSIST_STORAGE_KEY = 'waelly-query-cache'
const CACHE_OWNER_KEY = 'waelly-query-cache-user-id'

/**
 * Aucune des clés de `lib/query-keys.ts` (products.list(), dashboard.overview(),
 * etc.) n'inclut l'identité de l'utilisateur — par construction, ces clés
 * identifient un TYPE de donnée, pas « les produits de tel utilisateur ».
 * Le cache persistant survit pourtant à une déconnexion (il vit dans
 * localStorage, pas en mémoire) : sur un navigateur partagé entre plusieurs
 * comptes (ex. plusieurs collaborateurs sur le même poste), se connecter
 * avec un compte B après un compte A restaurait instantanément les produits,
 * le tableau de bord, etc. du compte A tant que le `staleTime` de chaque
 * requête n'avait pas expiré — des données mélangées entre utilisateurs.
 *
 * Appelée après CHAQUE résolution d'identité réussie (login, vérification
 * de code, callback OAuth, et le checkAuth() du montage initial) : si
 * l'utilisateur résolu diffère du dernier propriétaire connu du cache, on
 * vide tout avant que la moindre page n'ait pu lire une valeur périmée.
 * Une session identique (simple rafraîchissement de page) ne déclenche
 * rien : c'est justement ce que la persistance doit accélérer.
 */
export function ensureQueryCacheForUser(userId: string | null): void {
  if (typeof window === 'undefined') return

  if (userId === null) {
    queryClient.clear()
    window.localStorage.removeItem(PERSIST_STORAGE_KEY)
    window.localStorage.removeItem(CACHE_OWNER_KEY)
    return
  }

  const lastOwner = window.localStorage.getItem(CACHE_OWNER_KEY)
  if (lastOwner !== userId) {
    queryClient.clear()
    window.localStorage.removeItem(PERSIST_STORAGE_KEY)
    window.localStorage.setItem(CACHE_OWNER_KEY, userId)
  }
}
