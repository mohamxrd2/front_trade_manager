'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_PREFIX = 'wl-scroll:'

function readScroll(pathname: string): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + pathname)
    return raw == null ? null : Number(raw)
  } catch {
    return null
  }
}

function writeScroll(pathname: string, y: number) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + pathname, String(y))
  } catch {
    // Stockage indisponible (navigation privée stricte) : pas de restauration, tant pis.
  }
}

/**
 * Mémorise la position de défilement de chaque onglet (sessionStorage) pour
 * qu'en y revenant on retrouve la page là où on l'avait laissée — appelé une
 * seule fois, depuis le layout partagé (jamais démonté), jamais depuis une
 * page d'onglet individuelle.
 */
export function useTabScrollRestoration() {
  const pathname = usePathname()

  React.useEffect(() => {
    if (!pathname) return

    const saved = readScroll(pathname)
    if (saved != null) {
      requestAnimationFrame(() => window.scrollTo(0, saved))
    } else {
      window.scrollTo(0, 0)
    }

    const onScroll = () => writeScroll(pathname, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])
}
