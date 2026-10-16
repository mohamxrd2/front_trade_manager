import Link from 'next/link'

import { cn } from '@/lib/utils'

interface AuthLogoProps {
  /** Taille de l'orb en px — 40 sur Connexion, 36 sur Inscription (design/DESIGN.md). */
  size?: 40 | 36
  className?: string
  textClassName?: string
}

/**
 * Logo Waelly commun aux 3 pages d'authentification — orb "W" + texte,
 * lien vers /. Le texte hérite de sa couleur de l'appelant (blanc sur les
 * panneaux hero, encre sur les panneaux de formulaire clairs).
 */
export function AuthLogo({ size = 40, className, textClassName }: AuthLogoProps) {
  const radius = size === 40 ? 12 : 11
  const textSize = size === 40 ? 24 : 20

  return (
    <Link href="/" className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="flex shrink-0 items-center justify-center bg-[radial-gradient(100%_100%_at_30%_20%,#8C74FF,#3420B8)] font-extrabold text-white"
        style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.5 }}
      >
        W
      </span>
      <span className={cn('font-extrabold', textClassName)} style={{ fontSize: textSize }}>
        Waelly
      </span>
    </Link>
  )
}
