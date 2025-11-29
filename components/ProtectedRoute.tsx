'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Composant pour protéger les routes nécessitant une authentification
 * Redirige vers /login si l'utilisateur n'est pas connecté
 * Vérifie également l'authentification en cas d'erreur 401 depuis l'API
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading, checkAuth } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Vérifier l'authentification au montage et lors des changements de route
  useEffect(() => {
    const verifyAuth = async () => {
      if (!loading) {
        // Si on n'est pas authentifié, vérifier à nouveau (au cas où la session aurait expiré)
        if (!isAuthenticated) {
          await checkAuth()
        }
      }
    }

    verifyAuth()
  }, [pathname, loading, isAuthenticated, checkAuth])

  // Rediriger vers /login si non authentifié après vérification
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Utiliser window.location pour forcer une redirection complète
      // Cela évite les problèmes de navigation avec Next.js
      if (typeof window !== 'undefined' && pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  }, [isAuthenticated, loading, pathname])

  // Écouter les événements d'erreur 401 depuis l'intercepteur API
  useEffect(() => {
    const handleUnauthorized = async () => {
      // Vérifier à nouveau l'authentification
      await checkAuth()
      
      // Si toujours non authentifié, rediriger
      if (!isAuthenticated && pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [checkAuth, isAuthenticated, pathname])

  // Afficher un loader pendant la vérification de l'authentification
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-muted-foreground">Vérification de l&apos;authentification...</p>
        </div>
      </div>
    )
  }

  // Si l'utilisateur n'est pas authentifié, ne rien afficher (redirection en cours)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-muted-foreground">Redirection vers la page de connexion...</p>
        </div>
      </div>
    )
  }

  // Si l'utilisateur est authentifié, afficher le contenu
  return <>{children}</>
}
