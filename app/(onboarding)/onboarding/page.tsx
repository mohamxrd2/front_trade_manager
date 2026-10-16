'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { checkOnboarding } from '@/lib/services/onboarding'

/**
 * /onboarding — ne rend rien par elle-même : redirige vers l'étape à
 * reprendre (2 = entreprise, 3 = préférences). Le cas "déjà terminé" est
 * déjà intercepté par app/(onboarding)/layout.tsx (OnboardingDoneGuard)
 * avant que cette page ne s'exécute.
 */
export default function OnboardingIndexPage() {
  const router = useRouter()

  React.useEffect(() => {
    let cancelled = false

    checkOnboarding()
      .then((status) => {
        if (cancelled) return
        router.replace(status.next_step === 3 ? '/onboarding/preferences' : '/onboarding/entreprise')
      })
      .catch(() => {
        if (cancelled) return
        router.replace('/onboarding/entreprise')
      })

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[#5B3FE6]" />
    </div>
  )
}
