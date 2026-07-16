import useSWR from 'swr'
import { getArticles, getUserStats, getArticleById, type Article, type UserStats } from '../services/articles'

/**
 * Hook personnalisé pour récupérer les statistiques utilisateur
 * Utilise SWR pour la mise en cache et la revalidation automatique
 * 
 * @returns { stats, error, isLoading, isValidating, mutate }
 */
export function useUserStats() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<UserStats, Error>(
    '/api/user',
    getUserStats
  )

  return {
    stats: data,
    error,
    isLoading,
    isValidating,
    mutate,
  }
}

/**
 * Hook personnalisé pour récupérer la liste des articles
 * Utilise SWR pour la mise en cache et la revalidation automatique
 * 
 * @returns { articles, error, isLoading, isValidating, mutate }
 */
export function useArticles() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Article[], Error>(
    '/api/articles',
    getArticles
  )

  // Garantir qu'on retourne toujours un tableau
  const articles: Article[] = Array.isArray(data) ? data : []

  return {
    articles,
    error,
    isLoading,
    isValidating,
    mutate,
  }
}

/**
 * Hook personnalisé pour récupérer un article spécifique par son ID
 * 
 * @param id - L'ID de l'article (peut être null/undefined pour désactiver la requête)
 * @returns { article, error, isLoading, mutate }
 */
export function useArticle(id: string | number | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Article, Error>(
    id ? `/api/articles/${id}` : null, // Clé SWR (null désactive la requête)
    id ? () => getArticleById(id) : null, // Fonction fetcher
    {
      revalidateOnFocus: false, // Ne pas revalider automatiquement pour un article spécifique
      dedupingInterval: 10000, // Dédoublonner les requêtes pendant 10 secondes
      errorRetryCount: 2, // Réessayer 2 fois en cas d'erreur
      errorRetryInterval: 1000, // Attendre 1 seconde entre les tentatives
    }
  )

  return {
    article: data,
    error,
    isLoading,
    mutate,
  }
}

