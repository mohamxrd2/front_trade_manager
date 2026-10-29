import type { User } from '@/lib/auth'

/**
 * Chantier "Équipe" étape 3 — la page d'accueil varie selon le rôle :
 * propriétaire/gérant/caissier arrivent sur /dashboard (qui s'adapte
 * lui-même, voir app/(dashboard)/dashboard/page.tsx), un gestionnaire de
 * stock arrive directement sur /products, un comptable sur /analytics.
 * Utilisé à la fois après connexion (login/page.tsx) et comme cible de
 * redirection d'une route non autorisée (components/PermissionGuard.tsx).
 */
export function homeRouteForUser(user: Pick<User, 'is_owner' | 'role'> | null | undefined): string {
  if (!user || user.is_owner) return '/dashboard'

  switch (user.role) {
    case 'stock_manager':
      return '/products'
    case 'accountant':
      return '/analytics'
    default:
      // manager, cashier — ou un rôle futur inconnu : /dashboard reste une
      // cible sûre (il s'adapte lui-même à la permission wallet.view_balance).
      return '/dashboard'
  }
}
