/**
 * Chantier "Équipe" étape 3 — catalogue FRONT des permissions, pour l'écran
 * "Personnaliser les permissions" (groupes + explications en langage
 * simple). Les permissions elles-mêmes et les rôles viennent TOUJOURS du
 * backend (GET /api/team/roles, App\Support\Permissions côté serveur) —
 * ce fichier n'ajoute QUE de la présentation (groupe, libellé, explication),
 * jamais une permission qui n'existerait pas côté serveur.
 */
export type PermissionGroup = 'sales' | 'stock' | 'finance' | 'team'

export interface PermissionDef {
  key: string
  group: PermissionGroup
  labelKey: string
  descriptionKey: string
}

export const PERMISSION_GROUP_ORDER: PermissionGroup[] = ['sales', 'stock', 'finance', 'team']

export const PERMISSION_GROUP_LABEL_KEYS: Record<PermissionGroup, string> = {
  sales: 'team.permissionGroup.sales',
  stock: 'team.permissionGroup.stock',
  finance: 'team.permissionGroup.finance',
  team: 'team.permissionGroup.team',
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  { key: 'sales.create', group: 'sales', labelKey: 'team.permission.sales.create.label', descriptionKey: 'team.permission.sales.create.description' },
  { key: 'sales.view_own', group: 'sales', labelKey: 'team.permission.sales.view_own.label', descriptionKey: 'team.permission.sales.view_own.description' },
  { key: 'sales.view_all', group: 'sales', labelKey: 'team.permission.sales.view_all.label', descriptionKey: 'team.permission.sales.view_all.description' },
  { key: 'sales.delete_own_recent', group: 'sales', labelKey: 'team.permission.sales.delete_own_recent.label', descriptionKey: 'team.permission.sales.delete_own_recent.description' },
  { key: 'sales.delete_any', group: 'sales', labelKey: 'team.permission.sales.delete_any.label', descriptionKey: 'team.permission.sales.delete_any.description' },
  { key: 'clients.view', group: 'sales', labelKey: 'team.permission.clients.view.label', descriptionKey: 'team.permission.clients.view.description' },
  { key: 'clients.manage', group: 'sales', labelKey: 'team.permission.clients.manage.label', descriptionKey: 'team.permission.clients.manage.description' },
  { key: 'invoices.view', group: 'sales', labelKey: 'team.permission.invoices.view.label', descriptionKey: 'team.permission.invoices.view.description' },
  { key: 'invoices.manage', group: 'sales', labelKey: 'team.permission.invoices.manage.label', descriptionKey: 'team.permission.invoices.manage.description' },

  { key: 'stock.view', group: 'stock', labelKey: 'team.permission.stock.view.label', descriptionKey: 'team.permission.stock.view.description' },
  { key: 'stock.edit', group: 'stock', labelKey: 'team.permission.stock.edit.label', descriptionKey: 'team.permission.stock.edit.description' },
  { key: 'stock.restock', group: 'stock', labelKey: 'team.permission.stock.restock.label', descriptionKey: 'team.permission.stock.restock.description' },

  { key: 'expenses.create', group: 'finance', labelKey: 'team.permission.expenses.create.label', descriptionKey: 'team.permission.expenses.create.description' },
  { key: 'expenses.view', group: 'finance', labelKey: 'team.permission.expenses.view.label', descriptionKey: 'team.permission.expenses.view.description' },
  { key: 'deposits.manage', group: 'finance', labelKey: 'team.permission.deposits.manage.label', descriptionKey: 'team.permission.deposits.manage.description' },
  { key: 'wallet.view_balance', group: 'finance', labelKey: 'team.permission.wallet.view_balance.label', descriptionKey: 'team.permission.wallet.view_balance.description' },
  { key: 'analytics.view', group: 'finance', labelKey: 'team.permission.analytics.view.label', descriptionKey: 'team.permission.analytics.view.description' },
  { key: 'dashboard.full', group: 'finance', labelKey: 'team.permission.dashboard.full.label', descriptionKey: 'team.permission.dashboard.full.description' },
  { key: 'exports.download', group: 'finance', labelKey: 'team.permission.exports.download.label', descriptionKey: 'team.permission.exports.download.description' },

  { key: 'partners.view', group: 'team', labelKey: 'team.permission.partners.view.label', descriptionKey: 'team.permission.partners.view.description' },
  { key: 'team.manage', group: 'team', labelKey: 'team.permission.team.manage.label', descriptionKey: 'team.permission.team.manage.description' },
  { key: 'settings.manage', group: 'team', labelKey: 'team.permission.settings.manage.label', descriptionKey: 'team.permission.settings.manage.description' },
]

export type AssignableRole = 'manager' | 'cashier' | 'stock_manager' | 'accountant'

export const ASSIGNABLE_ROLES: AssignableRole[] = ['manager', 'cashier', 'stock_manager', 'accountant']

export interface RoleCardDef {
  role: AssignableRole
  nameKey: string
  phraseKey: string
}

export const ROLE_CARDS: RoleCardDef[] = [
  { role: 'manager', nameKey: 'team.role.manager', phraseKey: 'team.rolePhrase.manager' },
  { role: 'cashier', nameKey: 'team.role.cashier', phraseKey: 'team.rolePhrase.cashier' },
  { role: 'stock_manager', nameKey: 'team.role.stockManager', phraseKey: 'team.rolePhrase.stockManager' },
  { role: 'accountant', nameKey: 'team.role.accountant', phraseKey: 'team.rolePhrase.accountant' },
]
