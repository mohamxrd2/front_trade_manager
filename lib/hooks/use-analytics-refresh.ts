'use client'

import { useCallback } from 'react'

/**
 * Hook pour rafraîchir les données Analytics
 * Émet un événement personnalisé qui sera écouté par la page Analytics
 */
export function useAnalyticsRefresh() {
  const refreshAnalytics = useCallback(() => {
    // Émettre un événement personnalisé pour déclencher le rafraîchissement
    console.log('🔄 Émission de l\'événement analytics:refresh')
    window.dispatchEvent(new CustomEvent('analytics:refresh'))
  }, [])

  return { refreshAnalytics }
}

