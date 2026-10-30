/**
 * Chantier "Équipe" §6 — permission(s) requise(s) par page, en un seul
 * endroit : appliqué par le layout du tableau de bord (PermissionGuard) ET
 * par la navigation (menu latéral, barre du bas) — une page refusée n'y
 * apparaît jamais. Le serveur bloque de toute façon : ceci évite d'afficher
 * une page qui ne ferait que des 403.
 *
 * `anyOf` : au moins l'une ; `allOf` : toutes. Les règles les plus
 * spécifiques d'abord (/wallet/new avant /wallet).
 */
export interface RouteRule {
  anyOf?: string[]
  allOf?: string[]
}

const ROUTE_PERMISSIONS: Array<{ prefix: string } & RouteRule> = [
  { prefix: '/wallet/new', anyOf: ['sales.create', 'expenses.create', 'deposits.manage'] },
  // Gérant : tout le portefeuille. Caissier : « Mes opérations », ses seules opérations (filtrées côté serveur).
  { prefix: '/wallet', anyOf: ['wallet.view_balance', 'sales.view_own', 'sales.view_all'] },
  { prefix: '/analytics', anyOf: ['analytics.view'] },
  { prefix: '/products/new', anyOf: ['stock.edit'] },
  { prefix: '/products', anyOf: ['stock.view'] },
  { prefix: '/invoices/new', anyOf: ['invoices.manage'] },
  { prefix: '/invoices', anyOf: ['invoices.view'] },
  // Les pages Clients chargent les clients ET leurs factures : il faut les
  // deux (le caissier n'a que clients.view, pour choisir un client pendant
  // une vente ; le comptable n'a que invoices.view).
  { prefix: '/clients', allOf: ['clients.view', 'invoices.view'] },
  { prefix: '/team', anyOf: ['team.manage'] },
  { prefix: '/company', anyOf: ['settings.manage'] },
]

/** Règle de `pathname`, ou `null` si la page est ouverte à tout utilisateur connecté. */
export function routeRuleFor(pathname: string | null): RouteRule | null {
  if (!pathname) return null
  const path = pathname.split('?')[0]
  const rule = ROUTE_PERMISSIONS.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))
  return rule ? { anyOf: rule.anyOf, allOf: rule.allOf } : null
}

export function isRuleSatisfied(rule: RouteRule | null, can: (permission: string) => boolean): boolean {
  if (!rule) return true
  const anyOk = !rule.anyOf || rule.anyOf.length === 0 || rule.anyOf.some(can)
  const allOk = !rule.allOf || rule.allOf.every(can)
  return anyOk && allOk
}

/** Cette page est-elle accessible ? (garde des routes ET filtre de la navigation) */
export function isRouteAllowed(pathname: string, can: (permission: string) => boolean): boolean {
  return isRuleSatisfied(routeRuleFor(pathname), can)
}
