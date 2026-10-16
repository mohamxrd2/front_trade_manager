'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { isSilentError } from '@/lib/utils/error-handler'
import { checkOnboarding } from '@/lib/services/onboarding'

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [isChecking, setIsChecking] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const verifyOnboarding = async () => {
      // Ne pas vérifier si on est déjà sur une page d'onboarding (toutes
      // commencent par /onboarding : /onboarding, /onboarding/entreprise,
      // /onboarding/preferences)
      if (pathname.startsWith('/onboarding')) {
        setIsChecking(false)
        return
      }

      // Attendre que l'authentification soit vérifiée
      if (authLoading) {
        return
      }

      // Si non authentifié, ne pas vérifier l'onboarding
      if (!isAuthenticated) {
        setIsChecking(false)
        return
      }

      try {
        // Vérifier l'état d'onboarding
        const status = await checkOnboarding()

        // 'skipped' : l'utilisateur a choisi d'accéder au reste de l'app
        // sans compléter son profil — ne pas le renvoyer de force vers
        // /onboarding à chaque page, seul 'pending' doit encore y rediriger.
        if (status.onboarding_status === 'pending') {
          setNeedsOnboarding(true)
          router.push('/onboarding')
        } else {
          setIsChecking(false)
        }
      } catch (error) {
        // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
        if (isSilentError(error)) {
          setIsChecking(false)
          return
        }

        // Si erreur 404, l'onboarding n'existe pas encore, rediriger
        const axiosError = error as { response?: { status?: number } }
        if (axiosError?.response?.status === 404) {
          setNeedsOnboarding(true)
          router.push('/onboarding')
        } else {
          setIsChecking(false)
        }

        if (process.env.NODE_ENV !== 'production') {
          console.debug('Erreur lors de la vérification de l\'onboarding:', error)
        }
      }
    }

    verifyOnboarding()
  }, [pathname, router, isAuthenticated, authLoading])

  // Ne pas afficher le contenu pendant la vérification
  if (isChecking || needsOnboarding) {
    return <FullPageSpinner />
  }

  return <>{children}</>
}

