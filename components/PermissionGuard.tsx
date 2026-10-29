'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { homeRouteForUser } from '@/lib/permissions/home-route'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

interface PermissionGuardProps {
  /** Permission requise pour voir cette page. */
  permission: string
  children: React.ReactNode
}

/**
 * Filet de sécurité CÔTÉ CLIENT pour une page entière — le serveur bloque
 * de toute façon (le vrai filet, voir backend Gate::before/EnsurePermission),
 * ceci n'est qu'une redirection immédiate évitant d'afficher brièvement une
 * page interdite. Redirige vers la page d'accueil du rôle avec un toast,
 * au lieu de renvoyer /login (l'utilisateur EST connecté, juste pas
 * autorisé ici).
 */
export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { user, loading } = useAuth()
  const { can } = usePermissions()
  const router = useRouter()
  const { t } = useTranslation()
  const deniedRef = React.useRef(false)

  const allowed = !!user && can(permission)

  React.useEffect(() => {
    if (loading || !user || allowed || deniedRef.current) return

    deniedRef.current = true
    toast.error(t('team.accessDenied'))
    router.replace(homeRouteForUser(user))
  }, [loading, user, allowed, router, t])

  if (loading || !user || !allowed) {
    return <FullPageSpinner />
  }

  return <>{children}</>
}
