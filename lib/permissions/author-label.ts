import { roleLabelKey } from './role-labels'

export interface TransactionAuthor {
  id: string
  name: string | null
  role: string | null
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/** "par Koffi (Caissier)" — chantier "Équipe" §7. `null` si l'auteur n'est pas chargé ou sans nom. */
export function authorLabel(createdBy: TransactionAuthor | null | undefined, t: TranslateFn): string | null {
  if (!createdBy?.name) return null
  return t('transactions.byAuthor', { name: createdBy.name, role: t(roleLabelKey(createdBy.role)) })
}
