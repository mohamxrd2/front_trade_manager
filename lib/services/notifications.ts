import api from '@/lib/api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'

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

/**
 * Récupère les notifications de l'utilisateur
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
    })
    return response.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>
    
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

    if (axiosError.response?.status === 500) {
      const errorMessage = axiosError.response?.data?.message || 'Erreur serveur'
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 500 lors de la récupération des notifications:', errorMessage)
      }
      throw new Error(`Erreur serveur: ${errorMessage}`)
    }

    console.error('Erreur lors de la récupération des notifications:', error)
    throw new Error('Erreur lors du chargement des notifications')
  }
}

/**
 * Récupère le nombre de notifications non lues
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const response = await api.get<{ success: boolean; data: { unread_count: number } }>(
      '/api/notifications/unread-count'
    )
    return response.data.data.unread_count
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    console.error('Erreur lors de la récupération du nombre de notifications non lues:', error)
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
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 404) {
      throw new Error('Notification non trouvée')
    }

    console.error('Erreur lors du marquage de la notification comme lue:', error)
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
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    console.error('Erreur lors du marquage de toutes les notifications comme lues:', error)
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
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 404) {
      throw new Error('Notification non trouvée')
    }

    console.error('Erreur lors de la suppression de la notification:', error)
    throw new Error('Erreur lors de la suppression de la notification')
  }
}

