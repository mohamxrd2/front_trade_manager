import type { User } from '@/lib/auth'
import { isRouteAllowed } from '@/lib/permissions/route-permissions'

/**
 * Chantier "Équipe" étape 3 — la page d'accueil varie selon le rôle :
 * propriétaire/gérant/caissier arrivent sur /dashboard (qui s'adapte
 * lui-même, voir app/(dashboard)/dashboard/page.tsx), un gestionnaire de
 * stock sur /products, un comptable sur /analytics. Utilisé après
 * connexion, comme cible d'une route non autorisée (PermissionGuard) et
 * comme lien « accueil » (logo, retour).
 *
 * Toujours une page que la garde des routes AUTORISE : si les permissions
 * personnalisées du membre lui retirent la page de son rôle, on prend la
 * première page autorisée — jamais de boucle de redirection.
 */
const FALLBACK_ROUTES = ['/dashboard', '/products', '/analytics', '/wallet', '/invoices', '/notifications']

function preferredRoute(role: string | null | undefined): string {
  switch (role) {
    case 'stock_manager':
      return '/products'
    case 'accountant':
      return '/analytics'
    default:
      return '/dashboard'
  }
}

export function homeRouteForUser(user: Pick<User, 'is_owner' | 'role' | 'permissions'> | null | undefined): string {
  if (!user || user.is_owner) return '/dashboard'

  const preferred = preferredRoute(user.role)
  // Permissions pas encore connues (état transitoire) : la page du rôle.
  if (!user.permissions) return preferred

  const permissions = user.permissions
  const can = (p: string) => permissions.includes(p)
  if (isRouteAllowed(preferred, can)) return preferred
  return FALLBACK_ROUTES.find((route) => isRouteAllowed(route, can)) ?? '/notifications'
}
