'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

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
    return <FullPageSpinner />
  }

  // Si l'utilisateur est authentifié, ne rien afficher (redirection en cours)
  if (isAuthenticated) {
    return null
  }

  // Si l'utilisateur n'est pas authentifié, afficher le contenu (login/signup)
  return <>{children}</>
}

