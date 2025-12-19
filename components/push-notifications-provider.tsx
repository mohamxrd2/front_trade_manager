'use client'

import { useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Composant global pour initialiser les notifications push
 * S'active automatiquement quand l'utilisateur est connecté
 */
export function PushNotificationsProvider() {
  const { user } = useAuth()
  const { permission, requestPermission } = usePushNotifications()

  // Demander automatiquement la permission si l'utilisateur est connecté et que la permission n'est pas encore demandée
  useEffect(() => {
    if (user && permission === 'default' && 'Notification' in window) {
      // Optionnel : demander automatiquement la permission
      // Vous pouvez commenter cette ligne si vous préférez que l'utilisateur clique sur le bouton
      // requestPermission()
    }
  }, [user, permission, requestPermission])

  // Ce composant ne rend rien, il initialise juste les notifications push
  return null
}

