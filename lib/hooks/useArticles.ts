import { useQuery } from '@tanstack/react-query'
import { keys } from '@/lib/query-keys'
import { getArticles, getUserStats, getArticleById, type Article, type UserStats } from '../services/articles'

/**
 * Hook personnalisé pour récupérer les statistiques utilisateur.
 * Migré de SWR vers TanStack Query (cache unique de l'app, voir
 * lib/query-client.ts) — la forme retournée reste identique pour ne pas
 * casser les composants qui consomment déjà ce hook.
 */
export function useUserStats() {
  const { data, error, isLoading, isFetching, refetch } = useQuery<UserStats, Error>({
    queryKey: keys.userStats.all,
    queryFn: getUserStats,
  })

  return {
    stats: data,
    error: error ?? null,
    isLoading,
    isValidating: isFetching,
    mutate: refetch,
  }
}

/**
 * Hook personnalisé pour récupérer la liste des articles.
 * Migré de SWR vers TanStack Query — voir lib/hooks/useCache.ts pour les
 * invalidations (invalidateArticles, invalidateAll) déclenchées après une
 * mutation (ajout/modif/suppression d'article, vente, dépense…).
 */
export function useArticles(options: { enabled?: boolean } = {}) {
  const { data, error, isLoading, isFetching, refetch } = useQuery<Article[], Error>({
    queryKey: keys.products.list(),
    queryFn: getArticles,
    enabled: options.enabled ?? true,
  })

  // Garantir qu'on retourne toujours un tableau
  const articles: Article[] = Array.isArray(data) ? data : []

  return {
    articles,
    error: error ?? null,
    isLoading,
    isValidating: isFetching,
    mutate: refetch,
  }
}

/**
 * Hook personnalisé pour récupérer un article spécifique par son ID.
 *
 * @param id - L'ID de l'article (peut être null/undefined pour désactiver la requête)
 */
export function useArticle(id: string | number | null | undefined) {
  const { data, error, isLoading, refetch } = useQuery<Article, Error>({
    queryKey: keys.products.detail(String(id ?? '')),
    queryFn: () => getArticleById(id as string | number),
    enabled: id !== null && id !== undefined,
    // Équivalent du `revalidateOnFocus: false` + dedupingInterval de la
    // version SWR : une fiche article déjà ouverte n'a pas besoin de se
    // rafraîchir au focus de la fenêtre.
    refetchOnWindowFocus: false,
  })

  return {
    article: data,
    error: error ?? null,
    isLoading,
    mutate: refetch,
  }
}
