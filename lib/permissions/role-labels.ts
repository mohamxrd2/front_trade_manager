/**
 * Chantier "Équipe" — clé de traduction (team.role.*) pour un rôle donné.
 * Source UNIQUE : tout badge/texte de rôle affiché dans l'app (sidebar,
 * carte Équipe, cartes de rôle à l'ajout) passe par cette fonction, jamais
 * un libellé en dur — voir messages/{fr,en}/team.json.
 */
const ROLE_KEYS: Record<string, string> = {
  owner: 'team.role.owner',
  manager: 'team.role.manager',
  cashier: 'team.role.cashier',
  stock_manager: 'team.role.stockManager',
  accountant: 'team.role.accountant',
}

export function roleLabelKey(role: string | null | undefined): string {
  if (!role) return 'team.role.none'
  return ROLE_KEYS[role] ?? role
}

/** Couleur de pastille distincte par rôle (team.pill.* dans Tailwind, voir Team page). */
const ROLE_TONE: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'bg-brand-100', text: 'text-brand-700' },
  manager: { bg: 'bg-info-bg', text: 'text-info' },
  cashier: { bg: 'bg-success-bg', text: 'text-success-strong' },
  stock_manager: { bg: 'bg-warning-bg', text: 'text-warning' },
  accountant: { bg: 'bg-brand-100', text: 'text-brand-700' },
}

export function roleTone(role: string | null | undefined): { bg: string; text: string } {
  if (!role) return { bg: 'bg-surface-soft', text: 'text-subtle' }
  return ROLE_TONE[role] ?? { bg: 'bg-surface-soft', text: 'text-ink-2' }
}
