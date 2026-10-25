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
function SwipeableTransactionRow({ children, onRequestDelete, disabled = false, exiting = false, className }: SwipeableTransactionRowProps) {
  const { t } = useTranslation()
  const [dragX, setDragX] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const startXRef = React.useRef(0)
  const startedHorizontalRef = React.useRef<boolean | null>(null)
  const widthRef = React.useRef(0)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const resetDrag = () => setDragX(0)

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    startXRef.current = e.clientX
    startedHorizontalRef.current = null
    widthRef.current = containerRef.current?.offsetWidth ?? 320
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || !dragging) return
    const delta = e.clientX - startXRef.current

    // Décide une seule fois, au premier mouvement significatif, si c'est un
    // geste horizontal (on gère) ou vertical (on laisse le scroll de la
    // liste faire son travail — on ne capture jamais le pointeur dans ce cas).
    if (startedHorizontalRef.current === null && Math.abs(delta) > 6) {
      startedHorizontalRef.current = Math.abs(delta) > 6
    }
    if (startedHorizontalRef.current === false) return

    // Seul le glissement vers la gauche révèle l'action (jamais vers la
    // droite — rien à révéler de ce côté).
    const next = Math.min(0, Math.max(delta, -widthRef.current * LONG_SWIPE_RATIO - ACTION_WIDTH))
    setDragX(next)
  }

  const endDrag = () => {
    if (!dragging) return
    setDragging(false)

    const longSwipe = Math.abs(dragX) > widthRef.current * LONG_SWIPE_RATIO
    const revealed = Math.abs(dragX) > ACTION_WIDTH / 2

    if (longSwipe) {
      resetDrag()
      onRequestDelete()
    } else if (revealed) {
      setDragX(-ACTION_WIDTH)
    } else {
      resetDrag()
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
          resetDrag()
          onRequestDelete()
        }}
        aria-label={t('common.delete')}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 text-sm font-bold text-white"
        style={{ width: ACTION_WIDTH, backgroundColor: '#D92D20' }}
      >
        <Trash2 className="size-4" strokeWidth={2.2} />
        {t('common.delete')}
      </button>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={dragging ? '' : 'transition-transform duration-200'}
        style={{ transform: `translateX(${dragX}px)`, touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  )
}

export { SwipeableTransactionRow }
export type { SwipeableTransactionRowProps }
