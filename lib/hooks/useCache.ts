import { queryClient } from '@/lib/query-client'
import { keys } from '@/lib/query-keys'

/**
 * Invalidation du cache des stocks/stats utilisateur après une mutation
 * (ajout/modification/suppression d'article, vente, dépense…).
 *
 * Migré de SWR (`swrMutate`) vers TanStack Query : `invalidateQueries`
 * marque les requêtes périmées et déclenche un refetch EN ARRIÈRE-PLAN pour
 * tout composant actuellement monté (pas de skeleton — les données
 * actuelles restent affichées pendant le refetch, voir la règle d'affichage
 * dans app/providers.tsx).
 */

export function invalidateUserStats() {
  return queryClient.invalidateQueries({ queryKey: keys.userStats.all })
}

export function invalidateArticles() {
  return queryClient.invalidateQueries({ queryKey: keys.products.list() })
}

export function invalidateArticle(id: string | number) {
  return queryClient.invalidateQueries({ queryKey: keys.products.detail(String(id)) })
}

/**
 * Invalide tous les caches liés aux articles et aux statistiques utilisateur
 * (stock + badge "stock faible" du menu latéral).
 */
export async function invalidateAll() {
  return Promise.all([invalidateUserStats(), invalidateArticles()])
}
