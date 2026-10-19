'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

/**
 * Écoute l'évènement global `stale-client-detected`, émis par l'intercepteur
 * axios (lib/api.ts) quand le backend renvoie le code
 * STALE_CLIENT_MISSING_VARIATION (422 : une vente/réappro/facture sur un
 * article variable sans variation_id — ne peut venir que d'un client qui
 * tourne encore sur une version antérieure à l'introduction des variations).
 *
 * Il n'y a pas de service worker/PWA dans cette application (app/manifest.ts
 * ne fournit que les métadonnées d'installation, aucun cache offline) : la
 * seule action utile ici est de recharger la page pour récupérer le bundle
 * JS à jour depuis le serveur.
 */
export function StaleClientListener() {
  useEffect(() => {
    const handleStaleClient = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      toast.error(detail?.message || 'Mettez à jour l\'application : choisissez une variation', {
        id: 'stale-client-detected',
        duration: Infinity,
        action: {
          label: 'Recharger',
          onClick: () => window.location.reload(),
        },
      })
    }

    window.addEventListener('stale-client-detected', handleStaleClient)
    return () => window.removeEventListener('stale-client-detected', handleStaleClient)
  }, [])

  return null
}
