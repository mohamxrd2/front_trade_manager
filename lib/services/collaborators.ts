import api from '@/lib/api'
import type { AxiosError } from 'axios'
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
 * Gestion centralisée des erreurs des endpoints collaborateurs
 */
function handleCollaboratorError(error: unknown, context: string): never {
  if (isSilentError(error)) {
    throw error
  }

  const axiosError = error as AxiosError<{ message?: string; errors?: ValidationErrors }>
  const status = axiosError.response?.status

  if (status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Non authentifié')
  }

  if (status === 404) {
    throw new Error('Collaborateur non trouvé')
  }

  if (status === 403) {
    throw new Error(axiosError.response?.data?.message || 'Collaborateur non autorisé')
  }

  if (status === 422) {
    const validationErrors: ValidationErrors = axiosError.response?.data?.errors || {}
    throw { validationErrors, message: 'Erreur de validation' }
  }

  if (status && status >= 500) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`🚨 Erreur serveur ${context}:`, axiosError.response?.data)
    }
    throw new Error('Erreur serveur')
  }

  if (axiosError.response?.data?.message) {
    throw new Error(axiosError.response.data.message)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(`🚨 Erreur ${context}:`, error)
  }

  throw error
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
    handleCollaboratorError(error, 'getCollaborators')
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
    handleCollaboratorError(error, 'getCollaboratorById')
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
    handleCollaboratorError(error, 'createCollaborator')
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
    handleCollaboratorError(error, 'updateCollaborator')
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
    handleCollaboratorError(error, 'deleteCollaborator')
  }
}
