'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import api from '@/lib/api'

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

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  isConnected: boolean
  error: string | null
  refreshNotifications: () => Promise<void>
  refreshUnreadCount: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  retryConnection: () => Promise<void>
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // ✅ Polling toutes les 60 secondes (pas 5 secondes !)
  pollInterval: 60000,
  // ✅ Intervalle de retry quand déconnecté
  retryInterval: 120000, // 2 minutes
  // ✅ Nombre max de tentatives échouées avant pause
  maxFailedAttempts: 3,
  // ✅ Timeout pour les requêtes
  requestTimeout: 10000,
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Joue un son de notification
 */
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch {
    // Silencieux - pas de son disponible
  }
}

/**
 * Vérifie si c'est une erreur réseau
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
// HOOK
// ============================================================================

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const previousUnreadCountRef = useRef(0)
  
  // ✅ Compteur de tentatives échouées pour éviter le spam
  const failedAttempts = useRef(0)
  const isPollingPaused = useRef(false)
  const isMounted = useRef(true)

  // ✅ Récupérer le nombre de notifications non lues
  const refreshUnreadCount = useCallback(async () => {
    // Stop si trop d'erreurs consécutives
    if (failedAttempts.current >= CONFIG.maxFailedAttempts) {
      isPollingPaused.current = true
      return
    }

    try {
      const response = await api.get('/api/notifications/unread-count', { 
        timeout: CONFIG.requestTimeout 
      })
      
      if (!isMounted.current) return
      
      if (response.data.success) {
        const newCount = response.data.data?.unread_count ?? 0
        const previousCount = previousUnreadCountRef.current
        
        // Si le nombre de notifications non lues a augmenté, jouer le son
        if (newCount > previousCount && previousCount > 0) {
          playNotificationSound()
        }
        
        previousUnreadCountRef.current = newCount
        setUnreadCount(newCount)
        setIsConnected(true)
        setError(null)
        failedAttempts.current = 0 // Reset on success
      }
    } catch (err: unknown) {
      if (!isMounted.current) return
      
      failedAttempts.current++
      
      // ✅ Erreur réseau - serveur indisponible
      if (isNetworkError(err)) {
        setIsConnected(false)
        // ⚠️ NE PAS logger l'erreur en console pour éviter le spam
        return
      }
      
      // ✅ Erreur 401 - Session expirée (silencieux)
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr.response?.status === 401) {
        setIsConnected(true) // Serveur actif, juste pas authentifié
        return
      }
      
      // Autres erreurs - pas de log console
      setError('Erreur de chargement')
    }
  }, [])

  // ✅ Récupérer toutes les notifications
  const refreshNotifications = useCallback(async () => {
    if (failedAttempts.current >= CONFIG.maxFailedAttempts) {
      return
    }

    try {
      setLoading(true)
      const response = await api.get('/api/notifications', { 
        timeout: CONFIG.requestTimeout,
        params: { page: 1, per_page: 20 }
      })
      
      if (!isMounted.current) return
      
      if (response.data.success) {
        setNotifications(response.data.data?.notifications ?? [])
        const newCount = response.data.data?.unread_count ?? 0
        previousUnreadCountRef.current = newCount
        setUnreadCount(newCount)
        setIsConnected(true)
        setError(null)
        failedAttempts.current = 0
      }
    } catch (err: unknown) {
      if (!isMounted.current) return
      
      failedAttempts.current++
      
      if (isNetworkError(err)) {
        setIsConnected(false)
        return
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [])

  // ✅ Marquer comme lu
  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`)
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // Silencieux
    }
  }, [])

  // ✅ Marquer tout comme lu
  const markAllAsRead = useCallback(async () => {
    try {
      await api.put('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // Silencieux
    }
  }, [])

  // ✅ Réessayer la connexion
  const retryConnection = useCallback(async () => {
    try {
      // Test simple pour vérifier si le serveur répond
      const response = await api.get('/api/user', { timeout: 5000 })
      if (response.data) {
        failedAttempts.current = 0
        isPollingPaused.current = false
        setIsConnected(true)
        await refreshNotifications()
      }
    } catch {
      setIsConnected(false)
    }
  }, [refreshNotifications])

  // ✅ Effet initial
  useEffect(() => {
    isMounted.current = true
    refreshNotifications()
    
    return () => {
      isMounted.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Polling avec intervalle adaptatif
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPollingPaused.current) {
        refreshUnreadCount()
      } else {
        // ✅ Essayer de se reconnecter si déconnecté
        retryConnection()
      }
    }, CONFIG.pollInterval)

    return () => clearInterval(interval)
  }, [refreshUnreadCount, retryConnection])

  // ✅ Écouter les événements de focus pour rafraîchir
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Reset les compteurs quand l'utilisateur revient
        failedAttempts.current = 0
        isPollingPaused.current = false
        refreshUnreadCount()
      }
    }

    const handleFocus = () => {
      failedAttempts.current = 0
      isPollingPaused.current = false
      refreshUnreadCount()
    }

    const handleNotificationUpdate = () => {
      refreshUnreadCount()
      refreshNotifications()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('notification-updated', handleNotificationUpdate)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('notification-updated', handleNotificationUpdate)
    }
  }, [refreshUnreadCount, refreshNotifications])

  return {
    notifications,
    unreadCount,
    loading,
    isConnected,
    error,
    refreshNotifications,
    refreshUnreadCount,
    markAsRead,
    markAllAsRead,
    retryConnection,
  }
}
