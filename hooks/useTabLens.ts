'use client'

import * as React from 'react'
import { animate, useMotionValue, useTransform, useSpring, useVelocity, type MotionValue } from 'motion/react'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

interface TabRect {
  left: number
  width: number
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 }
const DRAG_UP_CANCEL_PX = 30
const DRAG_START_THRESHOLD_PX = 6

export interface UseTabLensOptions {
  tabCount: number
  /** Index à refléter quand on ne glisse pas le doigt (route réelle ou tap optimiste). */
  activeIndex: number
  containerRef: React.RefObject<HTMLElement | null>
  reducedMotion: boolean
  /** Appelé quand un glissement de doigt se termine sur un onglet (y compris si c'est le même). */
  onDragSettle: (index: number) => void
}

export interface UseTabLensResult {
  /** À poser sur l'élément <nav> — mesure + gestes de glissement du doigt. */
  navProps: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
    style: React.CSSProperties
  }
  /** Ref-callback à poser sur chaque bouton d'onglet (pour la mesure). */
  getTabRef: (index: number) => (node: HTMLElement | null) => void
  lensMotion: {
    x: MotionValue<number>
    width: MotionValue<number>
    scaleX: MotionValue<number>
    scaleY: MotionValue<number>
    scale: MotionValue<number>
    opacity: MotionValue<number>
    transformOrigin: MotionValue<string>
  }
  glowOpacity: MotionValue<number>
  /** Onglet actuellement enfoncé (tap en cours) — feedback visuel du bouton. */
  pressedIndex: number | null
  /** Onglet sous le doigt pendant un glissement actif — surligné en actif. */
  dragIndex: number | null
  /** La barre entière doit très légèrement se réduire pendant tout appui. */
  isPressing: boolean
}

export function useTabLens({
  tabCount,
  activeIndex,
  containerRef,
  reducedMotion,
  onDragSettle,
}: UseTabLensOptions): UseTabLensResult {
  const tabElsRef = React.useRef<(HTMLElement | null)[]>([])
  const [rects, setRects] = React.useState<TabRect[]>([])
  const rectsRef = React.useRef<TabRect[]>([])
  rectsRef.current = rects

  const x = useMotionValue(0)
  const width = useMotionValue(0)
  const opacity = useMotionValue(1)
  const velocity = useVelocity(x)

  const rawScaleX = useTransform(velocity, (v) => 1 + clamp(Math.abs(v) / 2500, 0, 0.35))
  const rawScaleY = useTransform(velocity, (v) => 1 - clamp(Math.abs(v) / 6000, 0, 0.12))
  const scaleX = useSpring(rawScaleX, { stiffness: 300, damping: 30 })
  const scaleY = useSpring(rawScaleY, { stiffness: 300, damping: 30 })

  const rawMoving = useTransform(velocity, (v) => clamp(Math.abs(v) / 400, 0, 1))
  const moving = useSpring(rawMoving, { stiffness: 200, damping: 40 })
  const scale = useTransform(moving, (m) => 1 + m * 0.04)
  const glowOpacity = moving

  const transformOrigin = useTransform(velocity, (v) => (v >= 0 ? '0% 50%' : '100% 50%')) as MotionValue<string>

  const [pressedIndex, setPressedIndex] = React.useState<number | null>(null)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  const measure = React.useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const containerInset = container.clientLeft
    const next = tabElsRef.current.slice(0, tabCount).map((el) => {
      if (!el) return { left: 0, width: 0 }
      const r = el.getBoundingClientRect()
      return { left: r.left - containerRect.left - containerInset, width: r.width }
    })
    setRects(next)
  }, [containerRef, tabCount])

  React.useLayoutEffect(() => {
    measure()
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(container)
    window.addEventListener('orientationchange', measure)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', measure)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure])

  const draggingRef = React.useRef(false)
  const gestureRef = React.useRef({ startX: 0, startY: 0, startIndex: -1, pointerId: -1, cancelled: false })
  const hasPositionedRef = React.useRef(false)

  // Pose la bulle sur l'onglet actif quand on ne glisse pas le doigt.
  React.useEffect(() => {
    if (draggingRef.current) return
    const rect = rects[activeIndex]
    if (!rect || rect.width === 0) return

    if (!hasPositionedRef.current) {
      // Première mesure : pas de glissement depuis nulle part, on se pose directement.
      hasPositionedRef.current = true
      x.set(rect.left)
      width.set(rect.width)
      return
    }

    if (reducedMotion) {
      x.set(rect.left)
      width.set(rect.width)
      opacity.set(0)
      animate(opacity, 1, { duration: 0.12 })
      return
    }

    animate(x, rect.left, SPRING)
    animate(width, rect.width, SPRING)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, rects, reducedMotion])

  const nearestIndexForX = React.useCallback((pointerXInContainer: number) => {
    const list = rectsRef.current
    if (list.length === 0) return -1
    let best = 0
    let bestDist = Infinity
    list.forEach((r, i) => {
      const center = r.left + r.width / 2
      const dist = Math.abs(pointerXInContainer - center)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    return best
  }, [])

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const container = containerRef.current
      if (!container) return
      const target = e.target as HTMLElement
      const tabEl = target.closest<HTMLElement>('[data-tab-index]')
      if (!tabEl) return
      const index = Number(tabEl.dataset.tabIndex)
      if (Number.isNaN(index)) return

      gestureRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startIndex: activeIndex,
        pointerId: e.pointerId,
        cancelled: false,
      }
      draggingRef.current = false
      setPressedIndex(index)
      // Pas de setPointerCapture ici : un simple tap doit laisser le click
      // natif du <Link> atteindre l'onglet pour naviguer. La capture n'est
      // engagée que si un glissement réel démarre (voir onPointerMove) —
      // sinon elle redirige aussi le mouseup/click vers le conteneur et la
      // navigation ne se déclenche jamais.
    },
    [activeIndex, containerRef]
  )

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current
      if (gesture.pointerId !== e.pointerId || gesture.startIndex === -1 && !draggingRef.current) return
      if (gesture.pointerId === -1) return

      const dx = e.clientX - gesture.startX
      const dy = e.clientY - gesture.startY

      if (!draggingRef.current) {
        if (Math.abs(dx) < DRAG_START_THRESHOLD_PX) return
        draggingRef.current = true
        containerRef.current?.setPointerCapture(e.pointerId)
      }

      const container = containerRef.current
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      const pointerXInContainer = e.clientX - containerRect.left - container.clientLeft

      if (dy < -DRAG_UP_CANCEL_PX) {
        gesture.cancelled = true
        const startRect = rectsRef.current[gesture.startIndex]
        if (startRect) {
          animate(x, startRect.left, SPRING)
          animate(width, startRect.width, SPRING)
        }
        setDragIndex(gesture.startIndex)
        return
      }
      gesture.cancelled = false

      const list = rectsRef.current
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const barMinCenter = first.left
      const barMaxCenter = last.left + last.width
      const clampedX = clamp(pointerXInContainer, barMinCenter, barMaxCenter)

      const index = nearestIndexForX(clampedX)
      const rect = list[index]
      if (rect) {
        x.set(clamp(clampedX - rect.width / 2, first.left, last.left + last.width - rect.width))
        width.set(rect.width)
      }
      setDragIndex(index)
      setPressedIndex(index)
    },
    [containerRef, nearestIndexForX, width, x]
  )

  const endGesture = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const gesture = gestureRef.current
      if (gesture.pointerId !== e.pointerId) return

      const container = containerRef.current
      if (container?.hasPointerCapture(e.pointerId)) {
        container.releasePointerCapture(e.pointerId)
      }

      if (draggingRef.current) {
        const settleIndex = gesture.cancelled ? gesture.startIndex : (dragIndex ?? gesture.startIndex)
        const rect = rectsRef.current[settleIndex]
        if (rect) {
          animate(x, rect.left, SPRING)
          animate(width, rect.width, SPRING)
        }
        if (!gesture.cancelled) {
          onDragSettle(settleIndex)
        }
      }

      draggingRef.current = false
      gestureRef.current = { startX: 0, startY: 0, startIndex: -1, pointerId: -1, cancelled: false }
      setPressedIndex(null)
      setDragIndex(null)
    },
    [containerRef, dragIndex, onDragSettle, width, x]
  )

  const getTabRef = React.useCallback(
    (index: number) => (node: HTMLElement | null) => {
      tabElsRef.current[index] = node
    },
    []
  )

  return {
    navProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endGesture,
      onPointerCancel: endGesture,
      style: { touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' },
    },
    getTabRef,
    lensMotion: { x, width, scaleX, scaleY, scale, opacity, transformOrigin },
    glowOpacity,
    pressedIndex,
    dragIndex,
    isPressing: pressedIndex !== null,
  }
}
