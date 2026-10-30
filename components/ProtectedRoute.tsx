'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { MUST_CHANGE_PASSWORD_EVENT, mustChangePasswordRedirect } from '@/lib/permissions/must-change-password'

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Composant pour protéger les routes nécessitant une authentification
 * Redirige vers /login si l'utilisateur n'est pas connecté
 * Vérifie également l'authentification en cas d'erreur 401 depuis l'API
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isAuthenticated, loading, checkAuth } = useAuth()
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

  // Code temporaire jamais remplacé (membre d'équipe) : seule
  // /change-password est accessible — Retour, rechargement ou URL tapée à la
  // main ramènent ici. `replace` pour que Retour ne revienne pas dessus.
  const changePasswordRedirect = mustChangePasswordRedirect(user, pathname)
  useEffect(() => {
    if (!loading && changePasswordRedirect) {
      router.replace(changePasswordRedirect)
    }
  }, [loading, changePasswordRedirect, router])

  // Le backend a répondu 403 MUST_CHANGE_PASSWORD (code réinitialisé par le
  // responsable pendant que le membre naviguait) : on recharge l'utilisateur
  // pour que la garde ci-dessus prenne le relais.
  useEffect(() => {
    const handleMustChangePassword = () => {
      void checkAuth()
    }
    window.addEventListener(MUST_CHANGE_PASSWORD_EVENT, handleMustChangePassword)
    return () => window.removeEventListener(MUST_CHANGE_PASSWORD_EVENT, handleMustChangePassword)
  }, [checkAuth])

  // Afficher un loader pendant la vérification de l'authentification
  if (loading || changePasswordRedirect) {
    return <FullPageSpinner />
  }

  // Si l'utilisateur n'est pas authentifié, ne rien afficher (redirection en cours)
  if (!isAuthenticated) {
    return <FullPageSpinner />
  }

  // Si l'utilisateur est authentifié, afficher le contenu
  return <>{children}</>
}
