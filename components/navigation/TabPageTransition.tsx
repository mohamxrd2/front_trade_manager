'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react'

import { resolveActiveTabIndex } from '@/lib/tabs'

const EASE = [0.2, 0.8, 0.2, 1] as const
const SLIDE_PX = 24

/** Même seuil que `md:hidden` sur BottomTabBar — ce pendant de contenu ne vaut que là où la barre d'onglets existe. */
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isMobile
}

/**
 * Glissement + fondu entre pages d'onglets (220ms), dans le sens du
 * changement d'onglet — pendant de BottomTabBar côté contenu. Clé = index
 * d'onglet (pas le pathname complet) : rester sur le même onglet
 * (ex. /invoices → /invoices/new) ne redéclenche pas la transition.
 * Désactivé sous prefers-reduced-motion et sur desktop (rendu direct, sans
 * wrapper motion) : la barre d'onglets n'existe pas en dehors du mobile.
 */
export function TabPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()
  const isMobile = useIsMobileViewport()
  const tabIndex = resolveActiveTabIndex(pathname)
  const transitionKey = tabIndex === -1 ? pathname : `tab-${tabIndex}`

  // Pattern React sanctionné ("adjusting state during rendering") : comparer
  // au rendu précédent sans passer par un ref (interdit en lecture/écriture
  // pendant le rendu, voir la règle react-hooks/refs) ni par un useEffect
  // (qui arriverait un rendu trop tard pour la toute première transition).
  const [prevTabIndex, setPrevTabIndex] = React.useState(tabIndex)
  const [direction, setDirection] = React.useState(1)
  if (tabIndex !== prevTabIndex) {
    setPrevTabIndex(tabIndex)
    if (tabIndex !== -1 && prevTabIndex !== -1) {
      setDirection(tabIndex > prevTabIndex ? 1 : -1)
    }
  }

  if (reducedMotion || !isMobile) {
    return <>{children}</>
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.div
          key={transitionKey}
          initial={{ opacity: 0, x: direction * SLIDE_PX }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -direction * SLIDE_PX }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  )
}
