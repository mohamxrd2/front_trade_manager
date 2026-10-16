'use client'

import * as React from 'react'

/**
 * Détecte le clavier virtuel ouvert sur mobile via visualViewport : la
 * barre d'onglets (components/navigation/BottomTabBar.tsx) se masque tant
 * qu'un champ de formulaire a le focus et que le clavier réduit vraiment la
 * hauteur visible (pas seulement la barre d'adresse qui se rétracte).
 *
 * Comparaison toujours LIVE (jamais de hauteur de référence mise en cache) :
 * sur une vraie ouverture de clavier, window.innerHeight (viewport de mise
 * en page) reste fixe pendant que visualViewport.height (viewport visuel)
 * se réduit. Sur une rotation d'écran, les deux changent ensemble — l'écart
 * reste proche de 0, pas de faux positif.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const handleResize = () => {
      const shrunk = window.innerHeight - vv.height
      setOpen(shrunk > 120)
    }

    vv.addEventListener('resize', handleResize)
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => {
      vv.removeEventListener('resize', handleResize)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return open
}
