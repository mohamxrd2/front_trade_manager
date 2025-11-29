'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface AuthRouteProps {
  children: ReactNode
}

/**
 * Composant pour protéger les routes d'authentification (login, signup)
 * Redirige vers /dashboard si l'utilisateur est déjà connecté
 */
export default function AuthRoute({ children }: AuthRouteProps) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, loading, router])

  // Afficher un loader pendant la vérification
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      </div>
    )
  }

  // Si l'utilisateur est authentifié, ne rien afficher (redirection en cours)
  if (isAuthenticated) {
    return null
  }

  // Si l'utilisateur n'est pas authentifié, afficher le contenu (login/signup)
  return <>{children}</>
}

