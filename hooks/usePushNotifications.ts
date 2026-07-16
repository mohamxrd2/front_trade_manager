'use client'

import { useEffect, useState, useCallback } from 'react'
import { getUnreadCount, type Notification } from '@/lib/services/notifications'

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

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0)

  // Demander la permission pour les notifications push
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Ce navigateur ne supporte pas les notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      setPermission('granted')
      return true
    }

    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    }

    return false
  }, [])

  // Afficher une notification push
  const showNotification = useCallback((notification: Notification) => {
    if (permission !== 'granted') {
      return
    }

    // Options de notification selon le type
    const notificationOptions: NotificationOptions = {
      body: notification.message,
      icon: '/icon-192x192.png', // Icône de l'application
      badge: '/badge-72x72.png', // Badge de l'application
      tag: notification.id, // Tag pour éviter les doublons
      requireInteraction: notification.type === 'warning' || notification.type === 'error', // Require interaction pour les alertes importantes
      silent: false,
      vibrate: notification.type === 'warning' || notification.type === 'error' ? [200, 100, 200] : undefined,
      data: {
        url: notification.action_url || '/notifications',
        notificationId: notification.id,
        type: notification.type,
      },
      timestamp: new Date(notification.created_at).getTime(),
    }

    try {
      const browserNotification = new Notification(notification.title, notificationOptions)

      browserNotification.onclick = () => {
        window.focus()
        if (notification.action_url) {
          window.location.href = notification.action_url
        }
        browserNotification.close()
      }

      browserNotification.onerror = (error) => {
        console.error('Erreur lors de l\'affichage de la notification push:', error)
      }

      // Fermer automatiquement après 7 secondes (plus long pour les alertes importantes)
      const autoCloseDelay = notification.type === 'warning' || notification.type === 'error' ? 10000 : 5000
      setTimeout(() => {
        browserNotification.close()
      }, autoCloseDelay)
    } catch (error) {
      console.error('Erreur lors de la création de la notification push:', error)
    }
  }, [permission])

  // Vérifier les nouvelles notifications et afficher des push
  const checkNewNotifications = useCallback(async () => {
    try {
      const currentUnreadCount = await getUnreadCount()

      // Si le nombre de notifications non lues a augmenté, récupérer les nouvelles
      if (currentUnreadCount > previousUnreadCount && previousUnreadCount > 0) {
        const { getNotifications } = await import('@/lib/services/notifications')
        const response = await getNotifications(1, 10, true) // Récupérer les 10 dernières non lues

        // Calculer le nombre de nouvelles notifications
        const newCount = currentUnreadCount - previousUnreadCount
        
        // Afficher une notification push pour chaque nouvelle notification
        const newNotifications = response.data.notifications.slice(0, newCount)

        // Afficher une notification push pour toutes les nouvelles notifications
        newNotifications.forEach((notification, index) => {
          // Délai progressif pour éviter de surcharger l'utilisateur
          setTimeout(() => {
            showNotification(notification)
            // Jouer le son de notification pour chaque nouvelle notification
            if (index === 0) {
              // Jouer le son seulement pour la première notification pour éviter trop de sons
              playNotificationSound()
            }
          }, index * 500) // 500ms entre chaque notification
        })
      } else if (currentUnreadCount > 0 && previousUnreadCount === 0) {
        // Première fois qu'on détecte des notifications non lues
        const { getNotifications } = await import('@/lib/services/notifications')
        const response = await getNotifications(1, 5, true)
        
        // Afficher seulement la plus récente
        if (response.data.notifications.length > 0) {
          showNotification(response.data.notifications[0])
          // Jouer le son de notification
          playNotificationSound()
        }
      }

      setPreviousUnreadCount(currentUnreadCount)
    } catch (error) {
      console.error('Erreur lors de la vérification des nouvelles notifications:', error)
    }
  }, [previousUnreadCount, showNotification])

  // Initialiser les notifications push et le compteur précédent
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
      
      // Initialiser le compteur précédent pour éviter d'afficher toutes les notifications existantes
      if (Notification.permission === 'granted') {
        getUnreadCount().then((count) => {
          setPreviousUnreadCount(count)
        }).catch((error) => {
          console.error('Erreur lors de l\'initialisation du compteur de notifications:', error)
        })
      }
    }
  }, [])

  // Vérifier les nouvelles notifications toutes les 15 secondes (plus réactif)
  useEffect(() => {
    if (permission === 'granted') {
      // Vérifier immédiatement au montage
      checkNewNotifications()

      const interval = setInterval(() => {
        checkNewNotifications()
      }, 15000) // Vérifier toutes les 15 secondes pour plus de réactivité

      return () => clearInterval(interval)
    }
  }, [permission, checkNewNotifications])

  return {
    permission,
    requestPermission,
    showNotification,
  }
}

