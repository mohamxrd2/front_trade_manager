'use client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface UsePermissionsResult {
  /** `true` si l'utilisateur connecté a cette permission (toujours `true` pour le propriétaire). */
  can: (permission: string) => boolean
  /** Rôle du membre (cashier/manager/stock_manager/accountant) — `null` pour le propriétaire. */
  role: string | null
  isOwner: boolean
  /** Liste effective complète — rarement utile directement, préférer can(). */
  permissions: string[]
}

/**
 * Hook UNIQUE pour toute décision d'interface basée sur les permissions —
 * alimenté par GET /api/user (déjà chargé par AuthContext, aucun appel
 * réseau supplémentaire). Voir components/Can.tsx et
 * components/PermissionGuard.tsx, qui s'appuient dessus.
 */
export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth()

  const permissions = useMemo(() => user?.permissions ?? [], [user])

  const can = useCallback((permission: string) => permissions.includes(permission), [permissions])

  return {
    can,
    role: user?.role ?? null,
    isOwner: user?.is_owner ?? false,
    permissions,
  }
}
