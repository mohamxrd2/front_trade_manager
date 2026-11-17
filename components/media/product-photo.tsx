'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Maximize2, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { displayableImage } from '@/lib/media/remote-hosts'
import { MediaImage } from './media-image'

/** Glissement vers le bas (px) ou vitesse (px/ms) au-delà desquels le plein écran se ferme. */
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 0.6

interface PhotoViewerProps {
  src: string | null | undefined
  alt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Photo en plein écran sur fond sombre, image entière. Fermeture : croix,
 * Échap, tap en dehors de la photo ou glissement vers le bas (mobile).
 */
export function PhotoViewer({ src, alt, open, onOpenChange }: PhotoViewerProps) {
  const { t } = useTranslation()
  const [ratio, setRatio] = React.useState<number | null>(null)
  const [dragY, setDragY] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const drag = React.useRef<{ pointerId: number; startY: number; lastY: number; lastT: number; velocity: number; moved: boolean } | null>(null)
  const justDragged = React.useRef(false)

  React.useEffect(() => {
    if (!open) {
      setDragY(0)
      setDragging(false)
    }
  }, [open])

  React.useEffect(() => setRatio(null), [src])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('[data-viewer-close]')) return
    drag.current = { pointerId: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dy = e.clientY - d.startY
    if (!d.moved) {
      if (Math.abs(dy) < 10) return
      d.moved = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
    // Vers le haut : résistance (rien à fermer de ce côté).
    setDragY(dy > 0 ? dy : dy / 4)
  }

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.pointerId !== e.pointerId || !d.moved) return
    justDragged.current = true
    setDragging(false)
    const dy = e.clientY - d.startY
    if (dy > DISMISS_DISTANCE || (dy > 0 && d.velocity > DISMISS_VELOCITY)) {
      onOpenChange(false)
    } else {
      setDragY(0)
    }
  }

  // Tap en dehors de la photo (sur le fond sombre) → fermer.
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    if (!(e.target as HTMLElement).closest('[data-viewer-photo]')) onOpenChange(false)
  }

  const fade = Math.max(0.35, 1 - Math.max(dragY, 0) / 400)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none"
          style={{ opacity: fade }}
        />
        <DialogPrimitive.Content
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={onBackdropClick}
          className="fixed inset-0 z-50 flex touch-none select-none items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none"
        >
          <DialogPrimitive.Title className="sr-only">{t('media.viewer.viewerTitle', { name: alt })}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t('media.viewer.viewerHint')}</DialogPrimitive.Description>
          <div
            data-viewer-photo
            className={cn('relative max-h-full max-w-full', !ratio && 'size-full', !dragging && 'transition-transform duration-300 ease-out motion-reduce:transition-none')}
            style={{
              transform: dragY ? `translate3d(0, ${dragY}px, 0)` : undefined,
              ...(ratio ? { aspectRatio: String(ratio), width: `min(100%, calc((100dvh - 6.5rem) * ${ratio}))` } : null),
            }}
          >
            <MediaImage
              src={src}
              alt={alt}
              fit="contain"
              sizes="100vw"
              priority
              className="size-full"
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
              }}
            />
          </div>
          <DialogPrimitive.Close
            data-viewer-close
            aria-label={t('media.viewer.close')}
            className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="size-5" strokeWidth={2} aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface ProductPhotoProps {
  src: string | null | undefined
  alt: string
  /** Affiché à la place de la photo quand il n'y en a pas. */
  fallback?: React.ReactNode
  /** Taille du cadre (fixe, pour que la page ne saute pas au chargement). */
  className?: string
  sizes?: string
  priority?: boolean
  /**
   * « frame » (défaut) : cadre de taille fixe (className), photo centrée.
   * « width » : largeur du parent, hauteur selon les proportions de la photo
   * (toutes les photos ont la même largeur) — plafonnée à 80 % de l'écran.
   */
  sizing?: 'frame' | 'width'
}

/** Proportions avant le chargement de la photo (« width ») : évite un cadre vide aplati. */
const DEFAULT_RATIO = 4 / 3

/**
 * Photo d'un article dans un cadre fixe : image entière (aucun recadrage),
 * centrée sur un fond neutre. Un clic ou un tap l'ouvre en plein écran.
 */
export function ProductPhoto({ src, alt, fallback, className, sizes = '480px', priority, sizing = 'frame' }: ProductPhotoProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [ratio, setRatio] = React.useState<number | null>(null)
  const url = displayableImage(src)
  React.useEffect(() => setRatio(null), [url])
  const byWidth = sizing === 'width'
  const frame = 'relative overflow-hidden rounded-tile border border-line bg-surface-soft'

  if (!url) return <div className={cn(frame, className)}>{fallback}</div>

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('media.viewer.open', { name: alt })}
        className={cn(
          frame,
          'block cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          byWidth && 'max-h-[80vh] w-full',
          className
        )}
        style={byWidth ? { aspectRatio: String(ratio ?? DEFAULT_RATIO) } : undefined}
      >
        <MediaImage
          src={url}
          alt={alt}
          fit="contain"
          sizes={sizes}
          priority={priority}
          className={byWidth ? 'absolute inset-0' : 'absolute inset-2'}
          fallback={fallback}
          onLoad={
            byWidth
              ? (e) => {
                  const img = e.currentTarget
                  if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight)
                }
              : undefined
          }
        />
        <span aria-hidden="true" className="absolute bottom-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-black/45 text-white">
          <Maximize2 className="size-4" strokeWidth={2} />
        </span>
      </button>
      <PhotoViewer src={url} alt={alt} open={open} onOpenChange={setOpen} />
    </>
  )
}
