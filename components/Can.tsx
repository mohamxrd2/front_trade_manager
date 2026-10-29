'use client'

import type { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface CanProps {
  permission: string
  children: ReactNode
  /** Affiché à la place quand la permission est absente — rien par défaut. */
  fallback?: ReactNode
}

/**
 * Affiche {children} seulement si l'utilisateur connecté a `permission` —
 * pour masquer un bouton d'action (Supprimer, Modifier le prix, Apport…),
 * jamais pour protéger une page entière (voir PermissionGuard pour ça).
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions()
  return can(permission) ? <>{children}</> : <>{fallback}</>
}
