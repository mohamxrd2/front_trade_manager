'use client'

import { useNotifications } from '@/hooks/useNotifications'
import { WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

/**
 * Indicateur de connexion au serveur
 * S'affiche uniquement quand le serveur est indisponible
 */
export function ConnectionIndicator() {
  const { isConnected, retryConnection } = useNotifications()
  const [isRetrying, setIsRetrying] = useState(false)

  // Ne rien afficher si connecté
  if (isConnected) {
    return null
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    await retryConnection()
    setIsRetrying(false)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg animate-pulse">
      <WifiOff className="w-5 h-5 flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">Serveur indisponible</span>
        <span className="text-xs opacity-80">Reconnexion automatique...</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="ml-2 text-white hover:bg-white/20"
        onClick={handleRetry}
        disabled={isRetrying}
      >
        <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}

