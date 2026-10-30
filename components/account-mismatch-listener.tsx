'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/**
 * Écoute l'évènement global `account-mismatch-detected`, émis par
 * l'intercepteur axios (lib/api.ts) quand le backend renvoie 409
 * ACCOUNT_MISMATCH : l'en-tête X-Account-Id (le compte affiché par CET
 * onglet) ne correspondait plus au compte de la session (cookie Sanctum
 * partagé entre onglets) — un AUTRE onglet s'est déconnecté puis reconnecté
 * à un autre compte. Rien n'a été enregistré côté serveur.
 *
 * Seule action sûre : recharger la page pour repartir d'un état cohérent
 * avec la session réelle (voir aussi SessionSyncListener, qui couvre le cas
 * où ce même changement est détecté SANS qu'une action ait été tentée).
 */
export function AccountMismatchListener() {
  const { t } = useTranslation()

  useEffect(() => {
    const handleMismatch = () => {
      toast.error(t('common.session.accountMismatch'), {
        id: 'account-mismatch-detected',
        duration: 2000,
      })

      setTimeout(() => {
        window.location.reload()
      }, 1500)
    }

    window.addEventListener('account-mismatch-detected', handleMismatch)
    return () => window.removeEventListener('account-mismatch-detected', handleMismatch)
  }, [t])

  return null
}
