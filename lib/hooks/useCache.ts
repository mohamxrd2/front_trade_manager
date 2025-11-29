import { mutate as swrMutate } from 'swr'

/**
 * Système d'invalidation de cache global avec SWR
 * 
 * Permet d'invalider les caches après des mutations (ajout, modification, suppression)
 * pour forcer le rafraîchissement des données avec affichage du skeleton
 */

/**
 * Clés SWR utilisées dans l'application
 */
export const SWR_KEYS = {
  USER_STATS: '/api/user',
  ARTICLES: '/api/articles',
  ARTICLE: (id: string | number) => `/api/articles/${id}`,
} as const

/**
 * Invalide le cache des statistiques utilisateur
 * Force une nouvelle récupération des données à la prochaine utilisation
 * 
 * @param showSkeleton - Si true, force la revalidation immédiate (affichera le skeleton)
 */
export function invalidateUserStats(showSkeleton = false) {
  if (showSkeleton) {
    // Forcer la revalidation immédiate pour afficher le skeleton
    return swrMutate(SWR_KEYS.USER_STATS, undefined, { 
      revalidate: true,
    })
  }
  // Invalidation simple sans revalidation immédiate
  return swrMutate(SWR_KEYS.USER_STATS)
}

/**
 * Invalide le cache de la liste des articles
 * Force une nouvelle récupération des données à la prochaine utilisation
 * 
 * @param showSkeleton - Si true, force la revalidation immédiate (affichera le skeleton)
 */
export function invalidateArticles(showSkeleton = false) {
  if (showSkeleton) {
    // Forcer la revalidation immédiate pour afficher le skeleton
    return swrMutate(SWR_KEYS.ARTICLES, undefined, { 
      revalidate: true,
    })
  }
  // Invalidation simple sans revalidation immédiate
  return swrMutate(SWR_KEYS.ARTICLES)
}

/**
 * Invalide le cache d'un article spécifique
 * @param id - L'ID de l'article
 */
export function invalidateArticle(id: string | number) {
  return swrMutate(SWR_KEYS.ARTICLE(id))
}

/**
 * Invalide tous les caches liés aux articles et aux statistiques
 * Utile après une mutation qui affecte plusieurs ressources
 * 
 * @param showSkeleton - Si true, force la revalidation immédiate (affichera le skeleton)
 */
export async function invalidateAll(showSkeleton = false) {
  if (showSkeleton) {
    // Forcer la revalidation immédiate pour afficher le skeleton
    // Utiliser mutate avec revalidate: true pour forcer le fetch
    const [userResult, articlesResult] = await Promise.all([
      swrMutate(SWR_KEYS.USER_STATS, undefined, { revalidate: true }),
      swrMutate(SWR_KEYS.ARTICLES, undefined, { revalidate: true }),
    ])
    return [userResult, articlesResult]
  }
  // Invalidation simple sans revalidation immédiate
  return Promise.all([
    invalidateUserStats(false),
    invalidateArticles(false),
  ])
}

/**
 * Revalide (refetch) immédiatement les statistiques utilisateur
 * Diffère de invalidate car cela récupère immédiatement les nouvelles données
 * 
 * @param showSkeleton - Si true, force la revalidation (affichera le skeleton si des données existent)
 */
export async function revalidateUserStats(showSkeleton = false) {
  return swrMutate(SWR_KEYS.USER_STATS, undefined, { 
    revalidate: true,
  })
}

/**
 * Revalide (refetch) immédiatement la liste des articles
 * 
 * @param showSkeleton - Si true, force la revalidation (affichera le skeleton si des données existent)
 */
export async function revalidateArticles(showSkeleton = false) {
  return swrMutate(SWR_KEYS.ARTICLES, undefined, { 
    revalidate: true,
  })
}

/**
 * Revalide tous les caches immédiatement
 * 
 * @param showSkeleton - Si true, affiche le skeleton pendant le rechargement
 */
export async function revalidateAll(showSkeleton = false) {
  return Promise.all([
    revalidateUserStats(showSkeleton),
    revalidateArticles(showSkeleton),
  ])
}

