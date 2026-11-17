'use client'

import * as React from 'react'
import Image from 'next/image'

import { cn } from '@/lib/utils'
import { displayableImage, isOptimizable } from '@/lib/media/remote-hosts'

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
}

/** Initiales d'un nom (« Awa Koné » → « AK »), repli des photos et logos. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * Image d'article, de logo ou de profil : next/image (chargement différé,
 * taille adaptée) dans une boîte que le parent dimensionne. Valeur vide ou
 * invalide, ou image qui ne charge pas → repli (initiales).
 */
export function MediaImage({ src, alt, fallback, sizes = '96px', className, imageClassName, priority }: MediaImageProps) {
  const url = displayableImage(src)
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const showImage = url && failedUrl !== url

  return (
    <span className={cn('relative flex items-center justify-center overflow-hidden', className)}>
      {showImage ? (
        <Image
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={!isOptimizable(url)}
          onError={() => setFailedUrl(url)}
          className={cn('object-cover', imageClassName)}
        />
      ) : (
        fallback
      )}
    </span>
  )
}
