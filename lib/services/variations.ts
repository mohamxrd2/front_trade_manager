import api from '../api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'

/**
 * Types pour les variations
 */

/**
 * Variation retournée par l'API Laravel
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
  created_at: string
  updated_at: string
}

/**
 * Payload pour créer une variation (POST /api/variations)
 */
export interface CreateVariationPayload {
  article_id: string
  name: string
  quantity: number
  image?: string | null
}

/**
 * Réponse API standard
 */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * Erreurs de validation
 */
export interface ValidationErrors {
  [field: string]: string[]
}

/**
 * Récupère toutes les variations d'un article depuis GET /api/variations
 * 
 * @param articleId - L'ID de l'article (requis pour filtrer les variations)
 * @returns La liste des variations filtrées par article_id
 * @throws Erreur si la requête échoue (401, 500, etc.)
 */
export async function getVariations(articleId: string | number): Promise<Variation[]> {
  try {
    // Appeler l'API avec le paramètre article_id pour filtrer
    const response = await api.get<ApiResponse<Variation[]>>(`/api/variations`, {
      params: {
        article_id: articleId
      }
    })
    
    if (!response.data.success || !response.data.data) {
      return []
    }
    
    const variations = Array.isArray(response.data.data) ? response.data.data : []
    
    // Filtrer côté client aussi pour garantir que seules les variations de cet article sont retournées
    const filteredVariations = variations.filter(
      (variation) => String(variation.article_id) === String(articleId)
    )
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Variations récupérées:', {
        articleId,
        total: variations.length,
        filtered: filteredVariations.length,
      })
    }
    
    return filteredVariations
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>

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
        console.error('🚨 Erreur 500 lors de la récupération des variations:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Erreur réseau ou autre
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Erreur lors de la récupération des variations:', {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      })
    }

    // En cas d'erreur, retourner un tableau vide plutôt que de throw
    return []
  }
}

/**
 * Crée une nouvelle variation pour un article
 * 
 * @param payload - Les données de la variation à créer
 * @returns La variation créée
 * @throws Erreur si la requête échoue (400, 422, 403, 500, etc.)
 */
export async function createVariation(payload: CreateVariationPayload): Promise<Variation> {
  try {
    const response = await api.post<ApiResponse<Variation>>('/api/variations', payload)
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Erreur lors de la création de la variation')
    }
    
    return response.data.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>

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

    // Erreur 422 : Erreur de validation
    if (axiosError.response?.status === 422) {
      const errors = axiosError.response.data?.errors || {}
      const validationError = new Error('Erreur de validation') as Error & { validationErrors?: ValidationErrors }
      validationError.validationErrors = errors
      throw validationError
    }

    // Erreur 400 : Article non variable, variation existe déjà, quantité dépasse le total
    if (axiosError.response?.status === 400) {
      const message = axiosError.response.data?.message || 'Erreur lors de la création de la variation'
      throw new Error(message)
    }

    // Erreur 403 : Article non trouvé ou non autorisé
    if (axiosError.response?.status === 403) {
      throw new Error('Article non trouvé ou non autorisé')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la création de la variation:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Erreur réseau ou autre
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Erreur lors de la création de la variation:', {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

/**
 * Payload pour modifier une variation
 */
export interface UpdateVariationPayload {
  name: string
  quantity: number
  image?: string | null
}

/**
 * Modifie une variation existante
 * 
 * @param id - L'ID de la variation à modifier
 * @param payload - Les données de la variation à modifier
 * @returns La variation modifiée
 * @throws Erreur si la requête échoue (400, 404, 403, 422, 500, etc.)
 */
export async function updateVariation(id: string | number, payload: UpdateVariationPayload): Promise<Variation> {
  try {
    const response = await api.put<ApiResponse<Variation>>(`/api/variations/${id}`, payload)
    
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'Erreur lors de la modification de la variation')
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Variation modifiée avec succès:', {
        id,
        name: response.data.data.name,
      })
    }
    
    return response.data.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>

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

    // Erreur 422 : Erreur de validation
    if (axiosError.response?.status === 422) {
      const errors = axiosError.response.data?.errors || {}
      const validationError = new Error('Erreur de validation') as Error & { validationErrors?: ValidationErrors }
      validationError.validationErrors = errors
      throw validationError
    }

    // Erreur 400 : Nom déjà utilisé, quantité dépasse le total
    if (axiosError.response?.status === 400) {
      const message = axiosError.response.data?.message || 'Erreur lors de la modification de la variation'
      throw new Error(message)
    }

    // Erreur 404 : Variation non trouvée
    if (axiosError.response?.status === 404) {
      const errorMessage = axiosError.response.data?.message || 'Variation non trouvée'
      throw new Error(errorMessage)
    }

    // Erreur 403 : Article non trouvé ou non autorisé
    if (axiosError.response?.status === 403) {
      throw new Error('Article non trouvé ou non autorisé')
    }

    // Erreur 500 : Erreur serveur
    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la modification de la variation:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Erreur réseau ou autre
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Erreur lors de la modification de la variation:', {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

/**
 * Supprime une variation
 * 
 * @param id - L'ID de la variation à supprimer
 * @returns Message de succès
 * @throws Erreur si la requête échoue (404, 403, 500, etc.)
 */
export async function deleteVariation(id: string | number): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.delete<ApiResponse<unknown>>(`/api/variations/${id}`)
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('✅ Variation supprimée avec succès:', {
        id,
        message: response.data.message,
      })
    }
    
    return {
      success: response.data.success || true,
      message: response.data.message || 'Variation supprimée avec succès',
    }
  } catch (error: unknown) {
    const axiosError = error as AxiosError<ApiResponse<unknown>>

    // Erreur 404 : Variation non trouvée
    if (axiosError.response?.status === 404) {
      const errorMessage = axiosError.response.data?.message || 'Variation non trouvée'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 404 lors de la suppression de la variation:', errorMessage)
      }
      throw new Error(errorMessage)
    }

    // Erreur 403 : Article non autorisé
    if (axiosError.response?.status === 403) {
      const errorMessage = axiosError.response.data?.message || 'Vous n\'êtes pas autorisé à supprimer cette variation'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 403 lors de la suppression de la variation:', errorMessage)
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
      const errorMessage = axiosError.response.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la suppression de la variation:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    // Autres erreurs
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur lors de la suppression de la variation:', {
        status: axiosError.response?.status,
        message: axiosError.message,
        data: axiosError.response?.data,
      })
    }

    throw error
  }
}

