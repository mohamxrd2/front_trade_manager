/**
 * Chantier "Équipe" §6 — permission(s) requise(s) par page, en un seul
 * endroit (appliqué par le layout du tableau de bord via PermissionGuard).
 * Une liste = au moins l'une d'elles. Le serveur bloque de toute façon :
 * ceci évite seulement d'afficher une page qui ne ferait que des 403.
 * Les règles les plus spécifiques d'abord (/wallet/new avant /wallet).
 */
const ROUTE_PERMISSIONS: Array<{ prefix: string; anyOf: string[] }> = [
  { prefix: '/wallet/new', anyOf: ['sales.create', 'expenses.create', 'deposits.manage'] },
  // Gérant : tout le portefeuille. Caissier : « Mes ventes », ses seules opérations (filtrées côté serveur).
  { prefix: '/wallet', anyOf: ['wallet.view_balance', 'sales.view_own', 'sales.view_all'] },
  { prefix: '/analytics', anyOf: ['analytics.view'] },
  { prefix: '/products/new', anyOf: ['stock.edit'] },
  { prefix: '/products', anyOf: ['stock.view'] },
  { prefix: '/invoices/new', anyOf: ['invoices.manage'] },
  { prefix: '/invoices', anyOf: ['invoices.view'] },
  // Les pages Clients affichent leurs factures : réservées à qui voit la facturation
  // (clients.view seul sert à choisir un client pendant une vente).
  { prefix: '/clients', anyOf: ['invoices.view'] },
  { prefix: '/team', anyOf: ['team.manage'] },
  { prefix: '/company', anyOf: ['settings.manage'] },
]

/** Permissions requises pour `pathname`, ou `null` si la page est ouverte à tout utilisateur connecté. */
export function requiredPermissionsFor(pathname: string | null): string[] | null {
  if (!pathname) return null
  const rule = ROUTE_PERMISSIONS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return rule ? rule.anyOf : null
}
