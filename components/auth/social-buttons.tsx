'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { IconBrandFacebookFilled } from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { SOCIAL_AUTH_URLS } from '@/lib/services/social-auth'
import { GoogleIcon } from './google-icon'

interface SocialButtonsProps {
  className?: string
}

/**
 * Boutons Google / Facebook communs aux 3 pages d'auth — grille 2 colonnes,
 * logos officiels, fond blanc pour les deux (design/DESIGN.md). Navigation
 * plein écran via <a href> (jamais de fetch — un code OAuth s'échange côté
 * callback, voir lib/services/social-auth.ts). Au clic : spinner dans le
 * bouton cliqué, les deux boutons désactivés le temps de la redirection.
 */
export function SocialButtons({ className }: SocialButtonsProps) {
  const [loading, setLoading] = React.useState<'google' | 'facebook' | null>(null)

  return (
    <div className={cn('grid grid-cols-2 gap-3 md:gap-2.5', className)}>
      <a
        href={SOCIAL_AUTH_URLS.google}
        onClick={() => setLoading('google')}
        aria-disabled={loading !== null}
        aria-label="Continuer avec Google"
        className={cn(
          'flex h-[52px] items-center justify-center gap-2 rounded-full border border-[#E2E2EA] bg-white text-[15px] font-semibold text-[#0E0E1A] transition-opacity',
          loading !== null && loading !== 'google' && 'pointer-events-none opacity-50'
        )}
      >
        {loading === 'google' ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <>
            <GoogleIcon className="size-5" />
            Google
          </>
        )}
      </a>
      <a
        href={SOCIAL_AUTH_URLS.facebook}
        onClick={() => setLoading('facebook')}
        aria-disabled={loading !== null}
        aria-label="Continuer avec Facebook"
        className={cn(
          'flex h-[52px] items-center justify-center gap-2 rounded-full border border-[#E2E2EA] bg-white text-[15px] font-semibold text-[#0E0E1A] transition-opacity',
          loading !== null && loading !== 'facebook' && 'pointer-events-none opacity-50'
        )}
      >
        {loading === 'facebook' ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <>
            <IconBrandFacebookFilled className="size-5 text-[#1877F2]" />
            Facebook
          </>
        )}
      </a>
    </div>
  )
}
