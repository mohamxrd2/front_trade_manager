'use client'

import * as React from 'react'
import { animate, useMotionValue, type MotionValue } from 'motion/react'

const SHRINK_SCALE = 0.92
const SHRINK_Y = 6
const SHRINK_LABEL_OPACITY = 0.6
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }
const IDLE_RESTORE_MS = 160

export interface ScrollShrinkMotion {
  scale: MotionValue<number>
  y: MotionValue<number>
  labelOpacity: MotionValue<number>
}

/**
 * Réduit doucement la barre d'onglets en défilant vers le bas (jamais
 * complètement masquée) ; elle reprend sa taille au défilement vers le
 * haut ou dès que le défilement s'arrête. Désactivé sous
 * prefers-reduced-motion : la barre reste à sa taille normale.
 */
export function useScrollShrink(reducedMotion: boolean): ScrollShrinkMotion {
  const scale = useMotionValue(1)
  const y = useMotionValue(0)
  const labelOpacity = useMotionValue(1)

  React.useEffect(() => {
    if (reducedMotion) return

    let lastY = window.scrollY
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let shrunk = false

    const setShrunk = (next: boolean) => {
      if (shrunk === next) return
      shrunk = next
      animate(scale, next ? SHRINK_SCALE : 1, SPRING)
      animate(y, next ? SHRINK_Y : 0, SPRING)
      animate(labelOpacity, next ? SHRINK_LABEL_OPACITY : 1, { duration: 0.2 })
    }

    const onScroll = () => {
      const currentY = window.scrollY
      const delta = currentY - lastY
      lastY = currentY

      if (idleTimer) clearTimeout(idleTimer)

      if (currentY <= 4) {
        setShrunk(false)
      } else if (delta > 2) {
        setShrunk(true)
      } else if (delta < -2) {
        setShrunk(false)
      }

      idleTimer = setTimeout(() => setShrunk(false), IDLE_RESTORE_MS)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (idleTimer) clearTimeout(idleTimer)
    }
  }, [reducedMotion, scale, y, labelOpacity])

  return { scale, y, labelOpacity }
}
