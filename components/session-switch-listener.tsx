'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/**
 * Écoute l'évènement global `session:account-switched`, émis par
 * AuthContext quand un AUTRE onglet (cookie Sanctum partagé) a changé de
 * compte — après avoir revérifié sa propre session et vidé le cache
 * TanStack Query (voir l'effet onSessionChange dans AuthContext.tsx).
 * Ce composant n'a qu'un rôle d'affichage : la synchronisation d'état a
 * déjà eu lieu avant que cet évènement ne soit émis.
 */
export function SessionSwitchListener() {
  const { t } = useTranslation()

  useEffect(() => {
    const handleSwitch = (event: Event) => {
      const detail = (event as CustomEvent<{ email?: string }>).detail
      if (!detail?.email) return

      toast.info(t('common.session.accountSwitched', { email: detail.email }), {
        id: 'session-account-switched',
      })
    }

    window.addEventListener('session:account-switched', handleSwitch)
    return () => window.removeEventListener('session:account-switched', handleSwitch)
  }, [t])

  return null
}
