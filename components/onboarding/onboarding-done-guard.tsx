'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { checkOnboarding } from '@/lib/services/onboarding'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'
import { isSilentError } from '@/lib/utils/error-handler'

/**
 * Garde interne au groupe (onboarding) : redirige vers /dashboard si
 * l'onboarding est déjà marqué 'done'. 'pending' ET 'skipped' laissent
 * passer — un utilisateur ayant choisi « Passer » peut toujours revenir
 * compléter son profil plus tard (design/onboarding § Passer).
 */
export function OnboardingDoneGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    checkOnboarding()
      .then((status) => {
        if (cancelled) return
        if (status.onboarding_status === 'done') {
          router.replace('/dashboard')
          return
        }
        setChecking(false)
      })
      .catch((error) => {
        if (cancelled || isSilentError(error)) return
        // Impossible de vérifier : on laisse l'utilisateur sur l'onboarding
        // plutôt que de le bloquer sur un loader indéfiniment.
        setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking) {
    return <FullPageSpinner />
  }

  return <>{children}</>
}
