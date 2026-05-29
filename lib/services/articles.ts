import api from '../api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'

/**
 * Types pour les données de l'API Laravel
 */

/**
 * Statistiques utilisateur retournées par GET /api/user
 */
export interface UserStats {
  total_articles: number
  total_remaining_quantity: number
  total_stock_value: number
  total_low_stock: number
  calculated_wallet?: number // Revenu total / Portefeuille calculé
  // Autres champs possibles de l'utilisateur
  id?: string
  first_name?: string
  last_name?: string
  email?: string
  [key: string]: unknown
}

/**
 * Variation d'article
 */
export interface Variation {
  id: string
  article_id: string
  name: string
  quantity: number
  image?: string | null
  sold_quantity: number
  remaining_quantity: number
  sales_percentage: number
  low_stock: boolean
  created_at?: string
  updated_at?: string
}

/**
 * Article retourné par GET /api/articles
 */
export interface Article {
  id: number
  name: string
  sale_price: number
  quantity: number
  type: 'simple' | 'variable'
  image?: string | null
  sold_quantity: number
  remaining_quantity: number
  sales_percentage: number
  low_stock: boolean
  stock_value: number
  variations?: Variation[]
  created_at?: string
  updated_at?: string
}

/**
 * Payload pour créer un article
 */
export interface ArticlePayload {
  name: string
  sale_price: number
  quantity: number
  type: 'simple' | 'variable'
  image?: string | null
}

/**
 * Payload pour modifier un article
 */
export interface UpdateArticlePayload {
  name: string
  sale_price: number
  quantity: number
}

/**
 * Réponse de création d'article
 */
export interface ArticleCreateResponse {
  success: boolean
  message: string
  data: Article
}

/**
 * Erreurs de validation Laravel
 */
export interface ValidationErrors {
  [field: string]: string[]
}

/**
 * Récupère les statistiques de l'utilisateur
 * 
 * @returns Les statistiques de l'utilisateur
 * @throws Erreur si la requête échoue (401 non authentifié, 500 serveur, etc.)
 */
export async function getUserStats(): Promise<UserStats> {
  try {
    const response = await api.get<{ data: UserStats } | UserStats>('/api/user')
    
    // Gérer différents formats de réponse
    let stats: UserStats
    const responseData = response.data
    
    if (responseData && typeof responseData === 'object') {
      // Format 1: { data: UserStats }
      if ('data' in responseData && responseData.data && typeof responseData.data === 'object') {
        const data = responseData.data as Record<string, unknown>
        if ('total_articles' in data) {
          stats = data as UserStats
        } else {
          throw new Error('Format de réponse API invalide: la clé "data" ne contient pas les statistiques attendues')
        }
      }
      // Format 2: UserStats directement
      else if ('total_articles' in responseData) {
        stats = responseData as UserStats
      } else {
        throw new Error('Format de réponse API invalide: structure de données inattendue')
      }
    } else {
      throw new Error('Format de réponse API invalide: réponse vide ou invalide')
    }
    
    // Log en développement pour debug
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Statistiques utilisateur récupérées:', {
        total_articles: stats.total_articles,
        total_stock_value: stats.total_stock_value,
      })
    }
    
    return stats
  } catch (error: unknown) {
    // Vérifier si c'est une erreur Axios
    const isAxiosError = error && typeof error === 'object' && 'response' in error
    const axiosError = isAxiosError ? (error as AxiosError<{ message?: string }>) : null

    // Erreur 401 : Non authentifié → rediriger vers /login
    // Ignorer si on est en train de se déconnecter (erreur silencieuse)
    if (axiosError?.response?.status === 401) {
      // Vérifier si c'est une erreur silencieuse de déconnexion
      const errorMessage = axiosError.message || ''
      if (errorMessage.includes('Unauthorized during logout') || 
          (error as Error & { silent?: boolean })?.silent) {
        // Pendant la déconnexion, ne pas lancer d'erreur visible
        throw new Error('Unauthorized during logout - Ignoring')
      }
      
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié. Redirection vers la page de connexion.')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError?.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la récupération des statistiques:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      if (axiosError) {
        console.error('🚨 Erreur lors de la récupération des statistiques:', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          message: axiosError.message,
          data: axiosError.response?.data,
          url: axiosError.config?.url,
          method: axiosError.config?.method,
        })
      } else {
        // Erreur non-Axios (réseau, parsing, etc.)
        console.error('🚨 Erreur lors de la récupération des statistiques (non-Axios):', {
          error,
          type: typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }

    // Si c'est une erreur réseau ou autre, créer un message d'erreur approprié
    if (axiosError) {
      const status = axiosError.response?.status
      const message = axiosError.response?.data?.message || axiosError.message || 'Erreur inconnue'
      throw new Error(`Erreur ${status || 'réseau'}: ${message}`)
    }

    // Erreur non-Axios
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la récupération des statistiques'
    throw new Error(errorMessage)
  }
}

/**
 * Normalise la réponse de la liste d'articles
 * Gère différents formats de réponse possibles
 * 
 * @param responseData - Les données brutes de la réponse API
 * @returns Un tableau d'articles normalisés
 */
function normalizeArticlesResponse(responseData: unknown): Article[] {
  // Si c'est déjà un tableau d'articles
  if (Array.isArray(responseData)) {
    return responseData as Article[]
  }

  // Si c'est un objet avec une clé 'data' qui contient un tableau
  if (responseData && typeof responseData === 'object') {
    const data = responseData as Record<string, unknown>
    
    if (data.data && Array.isArray(data.data)) {
      return data.data as Article[]
    }
    
    if (data.articles && Array.isArray(data.articles)) {
      return data.articles as Article[]
    }
    
    if (data.items && Array.isArray(data.items)) {
      return data.items as Article[]
    }
  }

  // Si c'est null, undefined, ou un type inattendu, retourner un tableau vide
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ Réponse API invalide pour /api/articles, structure inattendue:', {
      type: typeof responseData,
      value: responseData,
    })
  }

  return []
}

/**
 * Récupère la liste de tous les articles
 * 
 * @returns Un tableau d'articles
 * @throws Erreur si la requête échoue (401 non authentifié, 500 serveur, etc.)
 */
export async function getArticles(): Promise<Article[]> {
  try {
    const response = await api.get<{ data?: Article[] } | Article[]>('/api/articles')
    
    // Normaliser la réponse pour garantir un tableau
    const articles = normalizeArticlesResponse(response.data)
    
    // Log en développement pour debug
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Articles récupérés:', {
        count: articles.length,
        isArray: Array.isArray(articles),
        firstArticle: articles[0] || null,
      })
    }
    
    return articles
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>

    // Erreur 401 : Non authentifié → rediriger vers /login
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié. Redirection vers la page de connexion.')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la récupération des articles:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de la récupération des articles:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

/**
 * Normalise la réponse d'un article unique
 * Gère différents formats de réponse possibles
 * 
 * @param responseData - Les données brutes de la réponse API
 * @returns Un article normalisé
 * @throws Erreur si l'article n'est pas valide
 */
function normalizeArticleResponse(responseData: unknown): Article {
  // Si c'est déjà un objet Article valide
  if (responseData && typeof responseData === 'object') {
    const data = responseData as Record<string, unknown>
    
    // Vérifier si c'est directement un Article (avec les champs requis)
    if ('id' in data && 'name' in data && 'sale_price' in data) {
      return data as unknown as Article
    }
    
    // Vérifier si c'est un objet avec une clé 'data' qui contient l'article
    if (data.data && typeof data.data === 'object') {
      const articleData = data.data as Record<string, unknown>
      if ('id' in articleData && 'name' in articleData && 'sale_price' in articleData) {
        return articleData as unknown as Article
      }
    }
    
    // Vérifier si c'est un objet avec une clé 'article' qui contient l'article
    if (data.article && typeof data.article === 'object') {
      const articleData = data.article as Record<string, unknown>
      if ('id' in articleData && 'name' in articleData && 'sale_price' in articleData) {
        return articleData as unknown as Article
      }
    }
    
    // Si l'objet ne contient pas un article valide
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Réponse API inattendue pour /api/articles/{id}:', {
        type: typeof responseData,
        keys: Object.keys(data),
        data: responseData,
      })
    }
  }

  // Si c'est null, undefined, ou un type inattendu
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ Réponse API invalide pour /api/articles/{id}, structure inattendue:', {
      type: typeof responseData,
      value: responseData,
    })
  }

  throw new Error('Format de réponse API invalide pour l\'article')
}

/**
 * Récupère un article par son ID
 * 
 * @param id - L'ID de l'article à récupérer
 * @returns L'article correspondant
 * @throws Erreur si la requête échoue (404 non trouvé, 401 non authentifié, 500 serveur, etc.)
 */
export async function getArticleById(id: string | number): Promise<Article> {
  try {
    const response = await api.get<{ data?: Article } | Article>(`/api/articles/${id}`)
    
    // Normaliser la réponse pour garantir un Article valide
    const article = normalizeArticleResponse(response.data)
    
    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Article récupéré:', {
        id: article.id,
        name: article.name,
        type: article.type,
      })
    }
    
    return article
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>

    // Erreur 404 : Article non trouvé
    if (axiosError.response?.status === 404) {
      const errorMessage = axiosError.response?.data?.message || 'Article non trouvé'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 404 lors de la récupération de l\'article:', errorMessage)
      }
      throw new Error(errorMessage)
    }

    // Erreur 401 : Non authentifié → rediriger vers /login
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié. Redirection vers la page de connexion.')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la récupération de l\'article:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de la récupération de l\'article:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

/**
 * Crée un nouvel article
 * 
 * @param data - Les données de l'article à créer
 * @returns L'article créé avec les données complètes
 * @throws Erreur si la requête échoue (422 validation, 500 serveur, etc.)
 */
export async function addArticle(data: ArticlePayload): Promise<Article> {
  try {
    const response = await api.post<ArticleCreateResponse>('/api/articles', data)
    
    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Article créé avec succès:', {
        id: response.data.data.id,
        name: response.data.data.name,
      })
    }
    
    return response.data.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ 
      message?: string
      errors?: ValidationErrors
      success?: boolean
    }>

    // Erreur 422 : Validation Laravel
    if (axiosError.response?.status === 422) {
      // Les erreurs de validation sont dans axiosError.response.data.errors
      // On les re-throw avec une structure spéciale pour que le composant puisse les afficher
      const validationError = new Error(axiosError.response.data.message || 'Erreur de validation') as Error & {
        status: number
        errors: ValidationErrors
      }
      validationError.status = 422
      validationError.errors = axiosError.response.data.errors || {}
      throw validationError
    }

    // Erreur 401 : Non authentifié → rediriger vers /login
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié. Redirection vers la page de connexion.')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la création de l\'article:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de la création de l\'article:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

/**
 * Supprime un article
 * 
 * @param id - L'ID de l'article à supprimer
 * @returns Message de succès
 * @throws Erreur si la requête échoue (404 non trouvé, 403 non autorisé, 500 serveur, etc.)
 */
export async function deleteArticle(id: string | number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.delete<{ success: boolean; message: string }>(`/api/articles/${id}`)
    
    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Article supprimé avec succès:', {
        id,
        message: response.data.message,
      })
    }
    
    return response.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ 
      message?: string
      success?: boolean
    }>

    // Erreur 404 : Article non trouvé
    if (axiosError.response?.status === 404) {
      const errorMessage = axiosError.response?.data?.message || 'Article non trouvé'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 404 lors de la suppression de l\'article:', errorMessage)
      }
      throw new Error(errorMessage)
    }

    // Erreur 403 : Non autorisé (l'article n'appartient pas à l'utilisateur)
    if (axiosError.response?.status === 403) {
      const errorMessage = axiosError.response?.data?.message || 'Vous n\'êtes pas autorisé à supprimer cet article'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 403 lors de la suppression de l\'article:', errorMessage)
      }
      throw new Error(errorMessage)
    }

    // Erreur 401 : Non authentifié → rediriger vers /login
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié. Redirection vers la page de connexion.')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la suppression de l\'article:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de la suppression de l\'article:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

/**
 * Modifie un article existant
 * 
 * @param id - L'ID de l'article à modifier
 * @param data - Les données de l'article à modifier
 * @returns L'article modifié avec les données complètes
 * @throws Erreur si la requête échoue (404, 403, 422 validation, 500 serveur, etc.)
 */
// ============================================================================
// GESTION DU STOCK
// ============================================================================

/**
 * Utilisateur ayant effectué un réapprovisionnement
 */
export interface StockHistoryUser {
  id: string
  first_name: string
  last_name: string
  username: string
}

/**
 * Entrée de l'historique de réapprovisionnement
 */
export interface StockHistoryEntry {
  id: string
  user_id: string
  article_id: string
  quantity_added: number
  note: string | null
  created_at: string
  updated_at: string
  user: StockHistoryUser
}

/**
 * Résumé de l'historique de stock
 */
export interface StockHistorySummary {
  total_replenished: number
  replenishment_count: number
}

/**
 * Réponse complète de l'API stock-history
 */
export interface StockHistoryResponse {
  success: boolean
  message: string
  data: {
    article: {
      id: string
      name: string
      current_quantity: number
    }
    history: StockHistoryEntry[]
    summary: StockHistorySummary
    pagination: {
      current_page: number
      per_page: number
      total: number
      last_page: number
    }
  }
}

/**
 * Payload pour ajouter du stock
 */
export interface AddStockPayload {
  quantity: number
}

/**
 * Ajoute du stock à un article
 * 
 * @param articleId - L'ID de l'article
 * @param quantity - La quantité à ajouter (doit être >= 1)
 * @returns L'article mis à jour
 * @throws Erreur si la requête échoue (422 validation, 401 non authentifié, 500 serveur)
 */
export async function addStock(articleId: string | number, quantity: number): Promise<Article> {
  try {
    const response = await api.post<{ success: boolean; message: string; data: Article }>(
      `/api/articles/${articleId}/add-stock`,
      { quantity }
    )
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Stock ajouté avec succès:', {
        articleId,
        quantity,
        newTotal: response.data.data.quantity,
      })
    }
    
    return response.data.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ 
      message?: string
      errors?: ValidationErrors
    }>

    // Erreur 422 : Validation (quantity invalide)
    if (axiosError.response?.status === 422) {
      const validationError = new Error(
        axiosError.response.data.message || 'La quantité doit être supérieure à 0'
      ) as Error & {
        status: number
        errors: ValidationErrors
      }
      validationError.status = 422
      validationError.errors = axiosError.response.data.errors || {}
      throw validationError
    }

    // Erreur 404 : Article non trouvé
    if (axiosError.response?.status === 404) {
      throw new Error('Article non trouvé')
    }

    // Erreur 401 : Non authentifié
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de l\'ajout de stock:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de l\'ajout de stock:', error)
    }

    throw error
  }
}

/**
 * Récupère l'historique de réapprovisionnement d'un article
 * 
 * @param articleId - L'ID de l'article
 * @returns Objet contenant l'historique, le résumé et les infos article
 */
export async function getStockHistory(articleId: string | number): Promise<{
  history: StockHistoryEntry[]
  summary: StockHistorySummary
  article: { id: string; name: string; current_quantity: number } | null
}> {
  try {
    const response = await api.get<StockHistoryResponse>(
      `/api/articles/${articleId}/stock-history`
    )
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 Stock history API response:', response.data)
    }

    // Extraire les données de la structure imbriquée
    // Structure: response.data.data.history (pas response.data.history)
    const responseData = response.data
    
    if (!responseData.success || !responseData.data) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ Réponse API stock-history invalide:', responseData)
      }
      return {
        history: [],
        summary: { total_replenished: 0, replenishment_count: 0 },
        article: null
      }
    }

    const { history, summary, article } = responseData.data
    
    // Trier par date décroissante (plus récent en premier)
    const sortedHistory = [...(history || [])].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Historique de stock récupéré:', {
        articleId,
        entries: sortedHistory.length,
        totalReplenished: summary?.total_replenished || 0,
      })
    }
    
    return {
      history: sortedHistory,
      summary: summary || { total_replenished: 0, replenishment_count: 0 },
      article: article || null
    }
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>

    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Erreur getStockHistory:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data
      })
    }

    // Erreur 404 : Pas d'historique ou article non trouvé → retourner objet vide
    if (axiosError.response?.status === 404) {
      return {
        history: [],
        summary: { total_replenished: 0, replenishment_count: 0 },
        article: null
      }
    }

    // Erreur 401 : Non authentifié
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      throw new Error('Erreur serveur lors du chargement de l\'historique')
    }

    // Pour les autres erreurs, retourner un objet vide pour ne pas bloquer l'UI
    return {
      history: [],
      summary: { total_replenished: 0, replenishment_count: 0 },
      article: null
    }
  }
}

// ============================================================================
// MODIFICATION D'ARTICLE
// ============================================================================

export async function updateArticle(id: string | number, data: UpdateArticlePayload): Promise<Article> {
  try {
    const response = await api.put<ArticleCreateResponse>(`/api/articles/${id}`, data)
    
    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Article modifié avec succès:', {
        id,
        name: response.data.data.name,
      })
    }
    
    return response.data.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ 
      message?: string
      errors?: ValidationErrors
      success?: boolean
    }>

    // Erreur 422 : Validation Laravel
    if (axiosError.response?.status === 422) {
      const validationError = new Error(axiosError.response.data.message || 'Erreur de validation') as Error & {
        status: number
        errors: ValidationErrors
      }
      validationError.status = 422
      validationError.errors = axiosError.response.data.errors || {}
      throw validationError
    }

    // Erreur 404 : Article non trouvé
    if (axiosError.response?.status === 404) {
      const errorMessage = axiosError.response?.data?.message || 'Article non trouvé'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 404 lors de la modification de l\'article:', errorMessage)
      }
      throw new Error(errorMessage)
    }

    // Erreur 403 : Non autorisé (l'article n'appartient pas à l'utilisateur)
    if (axiosError.response?.status === 403) {
      const errorMessage = axiosError.response?.data?.message || 'Vous n\'êtes pas autorisé à modifier cet article'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 403 lors de la modification de l\'article:', errorMessage)
      }
      throw new Error(errorMessage)
    }

    // Erreur 401 : Non authentifié → rediriger vers /login
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié. Redirection vers la page de connexion.')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la modification de l\'article:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de la modification de l\'article:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}
