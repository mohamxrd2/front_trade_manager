'use client'

import { useEffect, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { homeRouteForUser } from '@/lib/permissions/home-route'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

interface AuthRouteProps {
  children: ReactNode
}

/**
 * Composant pour protéger les routes d'authentification (login, signup)
 * Redirige vers /dashboard si l'utilisateur est déjà connecté
 */
/**
 * « Mot de passe oublié » reste ouvert à un utilisateur connecté (lien depuis
 * Paramètres → Sécurité), et l'écran 3 le connecte lui-même puis choisit sa
 * destination (tableau de bord ou onboarding) : pas de redirection ici.
 */
const OPEN_WHEN_SIGNED_IN = ['/forgot-password', '/reset-password']

export default function AuthRoute({ children }: AuthRouteProps) {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const openWhenSignedIn = OPEN_WHEN_SIGNED_IN.some((path) => pathname?.startsWith(path))

  useEffect(() => {
    if (!loading && isAuthenticated && !openWhenSignedIn) {
      router.push(homeRouteForUser(user))
    }
  }, [isAuthenticated, loading, router, openWhenSignedIn])

  if (openWhenSignedIn) {
    return <>{children}</>
  }

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

