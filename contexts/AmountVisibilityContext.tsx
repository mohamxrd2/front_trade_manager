'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { readStoredAmountsHidden, writeStoredAmountsHidden } from '@/lib/amount-visibility/storage'

interface AmountVisibilityContextType {
  hidden: boolean
  toggle: () => void
}

const AmountVisibilityContext = createContext<AmountVisibilityContextType | undefined>(undefined)

/**
 * Réglage UNIQUE et GLOBAL (pas par écran) : « montants visibles » ou
 * « montants masqués », mémorisé sur l'appareil (localStorage) et restauré à
 * la réouverture de l'app. Monté une seule fois dans le layout du dashboard
 * (app/(dashboard)/layout.tsx) — couvre donc Tableau de bord, Portefeuille et
 * Analyses, qui partagent tous la même valeur.
 */
export function AmountVisibilityProvider({ children }: { children: ReactNode }) {
  // Toujours `false` (visible) au tout premier rendu, serveur ET client :
  // localStorage n'existe pas côté serveur, donc lire la vraie valeur ici
  // provoquerait un mismatch d'hydratation. La valeur réelle est appliquée
  // juste après le montage, exactement comme LanguageProvider pour la langue.
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lit localStorage, indisponible pendant le rendu serveur.
    setHidden(readStoredAmountsHidden())
  }, [])

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev
      writeStoredAmountsHidden(next)
      return next
    })
  }, [])

  // Raccourci clavier Maj+H (ordinateur) — désactivé quand le focus est dans
  // un champ de saisie (formulaire de vente/dépense, prix d'article…) pour
  // ne jamais intercepter la frappe d'un "H" majuscule pendant la saisie.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== 'h') return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true
      if (isEditable) return

      event.preventDefault()
      toggle()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle])

  return <AmountVisibilityContext.Provider value={value}>{children}</AmountVisibilityContext.Provider>
}

export function useAmountVisibility(): AmountVisibilityContextType {
  const context = useContext(AmountVisibilityContext)
  if (context === undefined) {
    throw new Error('useAmountVisibility must be used within an AmountVisibilityProvider')
  }
  return context
}
