'use client'

import * as React from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { checkOnboarding } from '@/lib/services/onboarding'
import { keys } from '@/lib/query-keys'

/**
 * Bannière discrète affichée en haut du tableau de bord quand l'utilisateur
 * a choisi « Passer pour l'instant » à l'onboarding (design/onboarding § Passer).
 * Masquée pour la session en cours via le bouton ✕ — réapparaît à la
 * prochaine visite tant que le profil n'est pas réellement complété.
 */
export function OnboardingSkippedBanner() {
  const [dismissed, setDismissed] = React.useState(false)

  const { data } = useQuery({
    queryKey: keys.onboarding.status(),
    queryFn: checkOnboarding,
    staleTime: 5 * 60 * 1000,
  })

  if (dismissed || data?.onboarding_status !== 'skipped') return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-[#F4F1FF] px-4 py-3">
      <p className="text-sm font-semibold text-[#3A20B8]">
        Complétez votre profil d&apos;entreprise{' '}
        <Link href="/settings?tab=entreprise" className="underline">
          Compléter maintenant
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer ce message"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#3A20B8]"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
