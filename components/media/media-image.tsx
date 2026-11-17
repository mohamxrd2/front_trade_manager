'use client'

import * as React from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils'
import { imageRenderer } from '@/lib/media/remote-hosts'

interface MediaImageProps {
  src: string | null | undefined
  alt: string
  /** Texte de repli (initiales) quand il n'y a pas d'image ou qu'elle ne charge pas. */
  fallback?: React.ReactNode
  /** Largeur d'affichage, pour que Next choisisse la bonne taille. */
  sizes?: string
  className?: string
  imageClassName?: string
  priority?: boolean
  /** « cover » (défaut) : recadrée pour remplir la boîte ; « contain » : image entière, sans recadrage. */
  fit?: 'cover' | 'contain'
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void
}

/** Initiales d'un nom (« Awa Koné » → « AK »), repli des photos et logos. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * Filet de sécurité : si next/image refuse quand même l'adresse (domaine
 * absent de la config chargée), on affiche une simple <img> au lieu de
 * faire planter toute la page.
 */
class NextImageBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // Rien à signaler à l'utilisateur : l'image s'affiche quand même, sans optimisation.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * Image d'article, de logo ou de profil, dans une boîte que le parent
 * dimensionne. next/image (taille adaptée, chargement différé) pour un
 * chemin du site ou un domaine déclaré dans next.config ; simple <img> pour
 * tout autre domaine — une adresse inconnue ne fait jamais planter la page.
 * Valeur vide ou invalide, ou image qui ne charge pas → repli (initiales).
 */
export function MediaImage({ src, alt, fallback, sizes = '96px', className, imageClassName, priority, fit = 'cover', onLoad }: MediaImageProps) {
  const renderer = imageRenderer(src)
  const url = renderer.kind === 'none' ? null : renderer.url
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const onError = () => setFailedUrl(url)
  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover'

  const plainImg = url ? (
    // eslint-disable-next-line @next/next/no-img-element -- domaine non déclaré pour next/image : affichée telle quelle.
    <img
      src={url}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      onError={onError}
      className={cn('absolute inset-0 size-full', fitClass, imageClassName)}
    />
  ) : null

  let content: React.ReactNode = fallback
  if (url && failedUrl !== url) {
    content =
      renderer.kind === 'next' ? (
        <NextImageBoundary key={url} fallback={plainImg}>
          <Image src={url} alt={alt} fill sizes={sizes} priority={priority} onLoad={onLoad} onError={onError} className={cn(fitClass, imageClassName)} />
        </NextImageBoundary>
      ) : (
        plainImg
      )
  }

  return <span className={cn('relative flex items-center justify-center overflow-hidden', className)}>{content}</span>
}
