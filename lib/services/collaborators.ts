import api from '@/lib/api'
import { isSilentError } from '@/lib/utils/error-handler'

/**
 * Interface pour un collaborateur
 */
export interface Collaborator {
  id: string
  user_id: string
  name: string
  phone: string
  part: number // Décimal entre 0.01 et 99.99
  image?: string | null
  wallet: number // Calculé automatiquement
  created_at: string
  updated_at: string
}

/**
 * Payload pour créer un collaborateur
 */
export interface CreateCollaboratorPayload {
  name: string
  phone: string
  part: number // Entre 0.01 et 99.99, doit être ≤ user.company_share
  image?: string | null
}

/**
 * Payload pour modifier un collaborateur
 */
export interface UpdateCollaboratorPayload {
  name?: string
  phone?: string
  image?: string | null
}

/**
 * Réponse API standard
 */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

/**
 * Erreurs de validation
 */
export interface ValidationErrors {
  [key: string]: string[]
}

/**
 * Récupérer la liste des collaborateurs
 */
export async function getCollaborators(): Promise<Collaborator[]> {
  try {
    const response = await api.get<ApiResponse<Collaborator[]>>('/api/collaborators')
    
    if (response.data.success && Array.isArray(response.data.data)) {
      return response.data.data
    }
    
    return []
  } catch (error: unknown) {
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } }
      
      if (axiosError.response?.status === 401) {
        // Rediriger vers la page de connexion
        window.location.href = '/login'
        throw new Error('Non authentifié')
      }
    }
    
    console.error('Erreur lors de la récupération des collaborateurs:', error)
    throw error
  }
}

/**
 * Récupérer les détails d'un collaborateur
 */
export async function getCollaboratorById(id: string): Promise<Collaborator> {
  try {
    const response = await api.get<ApiResponse<Collaborator>>(`/api/collaborators/${id}`)
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    
    throw new Error('Collaborateur non trouvé')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      
      if (axiosError.response?.status === 401) {
        window.location.href = '/login'
        throw new Error('Non authentifié')
      }
      
      if (axiosError.response?.status === 404) {
        throw new Error('Collaborateur non trouvé')
      }
      
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message)
      }
    }
    
    console.error('Erreur lors de la récupération du collaborateur:', error)
    throw error
  }
}

/**
 * Créer un collaborateur
 */
export async function createCollaborator(
  payload: CreateCollaboratorPayload
): Promise<Collaborator> {
  try {
    const response = await api.post<ApiResponse<Collaborator>>('/api/collaborators', payload)
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    
    throw new Error('Erreur lors de la création du collaborateur')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { 
        response?: { 
          status?: number
          data?: { 
            message?: string
            errors?: ValidationErrors
          }
        }
      }
      
      if (axiosError.response?.status === 401) {
        window.location.href = '/login'
        throw new Error('Non authentifié')
      }
      
      if (axiosError.response?.status === 422) {
        const validationErrors: ValidationErrors = axiosError.response.data?.errors || {}
        throw { validationErrors, message: 'Erreur de validation' }
      }
      
      if (axiosError.response?.status === 400) {
        throw new Error(axiosError.response.data?.message || 'Erreur lors de la création')
      }
      
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message)
      }
    }
    
    console.error('Erreur lors de la création du collaborateur:', error)
    throw error
  }
}

/**
 * Modifier un collaborateur
 */
export async function updateCollaborator(
  id: string,
  payload: UpdateCollaboratorPayload
): Promise<Collaborator> {
  try {
    const response = await api.put<ApiResponse<Collaborator>>(`/api/collaborators/${id}`, payload)
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    
    throw new Error('Erreur lors de la modification du collaborateur')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { 
        response?: { 
          status?: number
          data?: { 
            message?: string
            errors?: ValidationErrors
          }
        }
      }
      
      if (axiosError.response?.status === 401) {
        window.location.href = '/login'
        throw new Error('Non authentifié')
      }
      
      if (axiosError.response?.status === 404) {
        throw new Error('Collaborateur non trouvé')
      }
      
      if (axiosError.response?.status === 403) {
        throw new Error('Collaborateur non autorisé')
      }
      
      if (axiosError.response?.status === 422) {
        const validationErrors: ValidationErrors = axiosError.response.data?.errors || {}
        throw { validationErrors, message: 'Erreur de validation' }
      }
      
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message)
      }
    }
    
    console.error('Erreur lors de la modification du collaborateur:', error)
    throw error
  }
}

/**
 * Supprimer un collaborateur
 */
export async function deleteCollaborator(id: string): Promise<{ returned_part: number }> {
  try {
    const response = await api.delete<ApiResponse<{ returned_part: number }>>(`/api/collaborators/${id}`)
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    
    throw new Error('Erreur lors de la suppression du collaborateur')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { 
        response?: { 
          status?: number
          data?: { message?: string }
        }
      }
      
      if (axiosError.response?.status === 401) {
        window.location.href = '/login'
        throw new Error('Non authentifié')
      }
      
      if (axiosError.response?.status === 404) {
        throw new Error('Collaborateur non trouvé')
      }
      
      if (axiosError.response?.status === 403) {
        throw new Error('Collaborateur non autorisé')
      }
      
      if (axiosError.response?.data?.message) {
        throw new Error(axiosError.response.data.message)
      }
    }
    
    console.error('Erreur lors de la suppression du collaborateur:', error)
    throw error
  }
}

