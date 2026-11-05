'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

const ACTION_WIDTH = 88
// Au-delà de cette fraction de la largeur de la ligne, le relâchement
// déclenche directement la confirmation (pas besoin de relâcher sur le
// bouton rouge révélé) — "glissement long jusqu'au bord".
const LONG_SWIPE_RATIO = 0.55

interface SwipeableTransactionRowProps {
  children: React.ReactNode
  /** Appelé au tap sur le bouton rouge révélé OU sur un glissement long jusqu'au bord. */
  onRequestDelete: () => void
  /** Désactive le geste (ex. pendant le mode "Sélectionner" en multi-choix). */
  disabled?: boolean
  /** Applique l'animation de sortie (fondu + repli de hauteur) juste avant suppression réelle. */
  exiting?: boolean
  className?: string
}

/**
 * Ligne avec glissement vers la gauche façon iOS (voir maquettes
 * Collaborateurs/Portefeuille, design Liquid Glass) : révèle un bouton rouge
 * "Supprimer" derrière la ligne. Implémenté à la main avec les Pointer
 * Events (pas de lib de gestes dans le projet) — seul `transform` est animé
 * pendant le glissement, pour ne jamais déclencher de recalcul de layout et
 * ne pas gêner le défilement vertical de la liste.
 */
// Seuil avant de choisir la direction du geste (horizontal = on gère,
// vertical = on laisse défiler la liste).
const DIRECTION_SLOP = 8
// Projection de l'élan (formule d'Apple, Designing Fluid Interfaces) : un
// petit coup rapide ouvre ou referme la ligne même s'il n'a pas parcouru
// la moitié du bouton.
const DECELERATION = 0.99
const project = (velocityPxPerS: number) => ((velocityPxPerS / 1000) * DECELERATION) / (1 - DECELERATION)
// Résistance progressive au-delà des bornes, au lieu d'un arrêt sec.
const rubberband = (overshoot: number, dimension: number, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))

/** Valeur translateX réellement affichée (même au milieu d'une transition). */
function presentedX(el: HTMLElement | null): number {
  if (!el) return 0
  const transform = getComputedStyle(el).transform
  if (!transform || transform === 'none') return 0
  return new DOMMatrixReadOnly(transform).m41
}

function SwipeableTransactionRow({ children, onRequestDelete, disabled = false, exiting = false, className }: SwipeableTransactionRowProps) {
  const { t } = useTranslation()
  const [dragX, setDragX] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const gesture = React.useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    baseX: 0,
    width: 320,
    direction: null as 'horizontal' | 'vertical' | null,
    moved: false,
    samples: [] as { x: number; t: number }[],
  })

  const minX = () => -gesture.current.width * LONG_SWIPE_RATIO - ACTION_WIDTH

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    const g = gesture.current
    // Repart de la position AFFICHÉE : reprendre une ligne ouverte (ou en
    // train de se refermer) ne la fait pas sauter sous le doigt.
    const current = presentedX(trackRef.current)
    Object.assign(g, {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: current,
      width: containerRef.current?.offsetWidth ?? 320,
      direction: null,
      moved: false,
      samples: [{ x: current, t: e.timeStamp }],
    })
    setDragging(true)
    setDragX(current)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (disabled || !dragging || e.pointerId !== g.pointerId) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY

    if (g.direction === null) {
      if (Math.hypot(dx, dy) < DIRECTION_SLOP) return
      g.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      if (g.direction === 'vertical') {
        // Défilement de la liste : on rend la main, la ligne reste où elle était.
        setDragging(false)
        setDragX(g.baseX)
        return
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    g.moved = true
    const raw = g.baseX + dx
    const min = minX()
    const next = raw > 0 ? rubberband(raw, g.width) : raw < min ? min - rubberband(min - raw, g.width) : raw
    g.samples.push({ x: next, t: e.timeStamp })
    if (g.samples.length > 5) g.samples.shift()
    setDragX(next)
  }

  const endDrag = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!dragging || e.pointerId !== g.pointerId) return
    setDragging(false)
    if (g.direction !== 'horizontal') return

    const first = g.samples[0]
    const last = g.samples[g.samples.length - 1]
    const elapsed = last.t - first.t
    const velocity = elapsed > 0 ? ((last.x - first.x) / elapsed) * 1000 : 0

    // Suppression : seulement sur un glissement réellement long (position),
    // jamais sur un simple élan — un geste destructeur doit être voulu.
    if (Math.abs(dragX) > g.width * LONG_SWIPE_RATIO) {
      setDragX(0)
      onRequestDelete()
      return
    }

    const projected = dragX + project(velocity)
    setDragX(projected < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0)
  }

  // Après un glissement, ou ligne ouverte : le toucher ne doit pas ouvrir le
  // détail de l'opération — il referme la ligne.
  const onClickCapture = (e: React.MouseEvent) => {
    const g = gesture.current
    if (g.moved || dragX !== 0) {
      e.preventDefault()
      e.stopPropagation()
      g.moved = false
      if (!dragging) setDragX(0)
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden transition-[max-height,opacity] duration-300 ${
        exiting ? 'max-h-0 opacity-0' : 'max-h-[200px] opacity-100'
      } ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={() => {
          setDragX(0)
          onRequestDelete()
        }}
        // Bouton caché tant que la ligne est fermée : hors de la navigation clavier.
        tabIndex={dragX === 0 ? -1 : 0}
        aria-label={t('common.delete')}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 text-sm font-bold text-white"
        style={{ width: ACTION_WIDTH, backgroundColor: '#D92D20' }}
      >
        <Trash2 className="size-4" strokeWidth={2.2} />
        {t('common.delete')}
      </button>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={dragging ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:duration-0'}
        style={{ transform: `translateX(${dragX}px)`, touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  )
}

export { SwipeableTransactionRow }
export type { SwipeableTransactionRowProps }
