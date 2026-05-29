import api from '@/lib/api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'

// ============================================================================
// TYPES
// ============================================================================

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  read: boolean
  article_id?: string
  action_url?: string
  created_at: string
  article?: {
    id: string
    name: string
    type: string
  }
}

export interface NotificationsResponse {
  success: boolean
  message: string
  data: {
    notifications: Notification[]
    pagination: {
      current_page: number
      per_page: number
      total: number
      last_page: number
    }
    unread_count: number
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Vérifie si c'est une erreur réseau (serveur down)
 */
function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { message?: string; code?: string; response?: unknown }
  return (
    err.message === 'Network Error' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ERR_NETWORK' ||
    !err.response
  )
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Récupère les notifications de l'utilisateur
 * ✅ Gère les erreurs réseau silencieusement
 */
export async function getNotifications(
  page: number = 1,
  perPage: number = 20,
  unreadOnly: boolean = false
): Promise<NotificationsResponse> {
  try {
    const response = await api.get<NotificationsResponse>('/api/notifications', {
      params: {
        page,
        per_page: perPage,
        unread_only: unreadOnly,
      },
      timeout: 10000, // 10 secondes max
    })
    return response.data
  } catch (error: unknown) {
    // ✅ Erreur réseau - retourner une réponse vide silencieusement
    if (isNetworkError(error)) {
      return {
        success: false,
        message: 'network_error',
        data: {
          notifications: [],
          pagination: { current_page: 1, per_page: perPage, total: 0, last_page: 1 },
          unread_count: 0,
        },
      }
    }
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    const axiosError = error as AxiosError<{ message?: string }>
    
    // ✅ Erreur 401 - silencieux (géré par le hook)
    if (axiosError.response?.status === 401) {
      return {
        success: false,
        message: 'unauthorized',
        data: {
          notifications: [],
          pagination: { current_page: 1, per_page: perPage, total: 0, last_page: 1 },
          unread_count: 0,
        },
      }
    }

    // ✅ Erreur 500 - log uniquement en dev
    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[Notifications] Erreur serveur:', axiosError.response?.data?.message)
      }
      return {
        success: false,
        message: 'server_error',
        data: {
          notifications: [],
          pagination: { current_page: 1, per_page: perPage, total: 0, last_page: 1 },
          unread_count: 0,
        },
      }
    }

    // Autres erreurs - retourner une réponse vide
    return {
      success: false,
      message: 'unknown_error',
      data: {
        notifications: [],
        pagination: { current_page: 1, per_page: perPage, total: 0, last_page: 1 },
        unread_count: 0,
      },
    }
  }
}

/**
 * Récupère le nombre de notifications non lues
 * ✅ Gère les erreurs réseau silencieusement
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await api.get<{ success: boolean; data: { unread_count: number } }>(
      '/api/notifications/unread-count',
      { timeout: 10000 }
    )
    return response.data.data.unread_count
  } catch (error: unknown) {
    // ✅ Erreur réseau - retourner 0 silencieusement
    if (isNetworkError(error)) {
      return 0
    }
    
    // Vérifier si c'est une erreur silencieuse
    if (isSilentError(error)) {
      return 0
    }
    
    const axiosError = error as AxiosError<{ message?: string }>
    
    // ✅ Erreur 401 - silencieux
    if (axiosError.response?.status === 401) {
      return 0
    }

    // ✅ Autres erreurs - retourner 0 sans log
    return 0
  }
}

/**
 * Marque une notification comme lue
 */
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await api.put(`/api/notifications/${notificationId}/read`)
  } catch (error: unknown) {
    if (isSilentError(error) || isNetworkError(error)) {
      return // Silencieux
    }
    
    const axiosError = error as AxiosError<{ message?: string }>
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 404) {
      throw new Error('Notification non trouvée')
    }

    throw new Error('Erreur lors du marquage de la notification comme lue')
  }
}

/**
 * Marque toutes les notifications comme lues
 */
export async function markAllAsRead(): Promise<void> {
  try {
    await api.put('/api/notifications/read-all')
  } catch (error: unknown) {
    if (isSilentError(error) || isNetworkError(error)) {
      return // Silencieux
    }
    
    const axiosError = error as AxiosError<{ message?: string }>
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    throw new Error('Erreur lors du marquage de toutes les notifications comme lues')
  }
}

/**
 * Supprime une notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await api.delete(`/api/notifications/${notificationId}`)
  } catch (error: unknown) {
    if (isSilentError(error) || isNetworkError(error)) {
      return // Silencieux
    }
    
    const axiosError = error as AxiosError<{ message?: string }>
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 404) {
      throw new Error('Notification non trouvée')
    }

    throw new Error('Erreur lors de la suppression de la notification')
  }
}
