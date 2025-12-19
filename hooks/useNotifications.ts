'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getUnreadCount, getNotifications, type Notification } from '@/lib/services/notifications'

/**
 * Joue un son de notification
 */
function playNotificationSound() {
  try {
    // Créer un contexte audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Créer un oscillateur pour générer le son
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    // Connecter l'oscillateur au gain puis à la sortie
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    // Configuration du son (fréquence, type d'onde)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // Fréquence de 800 Hz
    oscillator.type = 'sine' // Type d'onde sinusoïdale (son doux)
    
    // Enveloppe du son (fade in/out)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01) // Fade in rapide
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2) // Fade out
    
    // Démarrer et arrêter le son
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2) // Durée de 200ms
  } catch (error) {
    console.error('Erreur lors de la lecture du son de notification:', error)
  }
}

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const previousUnreadCountRef = useRef(0)

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await getNotifications(1, 20)
      setNotifications(response.data.notifications)
      setUnreadCount(response.data.unread_count)
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error)
      // En cas d'erreur, garder les notifications existantes
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount()
      const previousCount = previousUnreadCountRef.current
      
      // Si le nombre de notifications non lues a augmenté, jouer le son
      if (count > previousCount && previousCount > 0) {
        playNotificationSound()
      }
      
      // Mettre à jour le compteur précédent
      previousUnreadCountRef.current = count
      setUnreadCount(count)
    } catch (error) {
      console.error('Erreur lors de la récupération du nombre de notifications non lues:', error)
    }
  }, [])

  // Vérifier les nouvelles notifications toutes les 5 secondes pour plus de réactivité
  useEffect(() => {
    // Initialiser le compteur précédent au chargement
    getUnreadCount().then((count) => {
      previousUnreadCountRef.current = count
      setUnreadCount(count)
    }).catch((error) => {
      console.error('Erreur lors de l\'initialisation du compteur:', error)
    })
    
    refreshNotifications()

    const interval = setInterval(() => {
      refreshUnreadCount()
      // Rafraîchir aussi la liste complète périodiquement
      refreshNotifications()
    }, 5000) // Vérifier toutes les 5 secondes pour plus de réactivité

    return () => clearInterval(interval)
  }, [refreshNotifications, refreshUnreadCount])

  // Écouter les événements de mise à jour des notifications depuis d'autres composants
  useEffect(() => {
    const handleNotificationUpdate = () => {
      refreshUnreadCount()
      refreshNotifications()
    }

    // Écouter les événements personnalisés pour forcer une mise à jour
    window.addEventListener('notification-updated', handleNotificationUpdate)
    window.addEventListener('focus', handleNotificationUpdate) // Mettre à jour quand la fenêtre reprend le focus

    return () => {
      window.removeEventListener('notification-updated', handleNotificationUpdate)
      window.removeEventListener('focus', handleNotificationUpdate)
    }
  }, [refreshNotifications, refreshUnreadCount])

  return {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    refreshUnreadCount,
  }
}

