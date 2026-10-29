import type { Transaction } from '@/lib/services/transactions'
import { getTransactionVisual } from './transaction-visual'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/**
 * Une opération reconstituée à partir de la liste PLATE de transactions
 * (GET /api/transactions) — groupée par `operation_id`, pas par position :
 * deux lignes de la MÊME opération sont fusionnées même si une pagination
 * ou un tri inhabituel les a séparées dans le tableau d'entrée (seul un
 * découpage entre deux PAGES différentes resterait visible comme deux
 * groupes distincts — limite connue et acceptée, une opération de plusieurs
 * lignes a toutes ses lignes au même instant donc quasi toujours sur la
 * même page).
 *
 * Alternative délibérément écartée : re-fetcher GET /api/operations pour
 * l'affichage de la liste. Le panier aurait alors sa propre pagination/
 * recherche à maintenir en plus de celle, déjà existante et testée, de
 * GET /api/transactions — cette fonction pure réutilise cette dernière sans
 * dupliquer sa logique de recherche/filtre/pagination.
 */
export interface OperationGroup {
  operationId: string
  operationCode: string | null
  type: string
  paymentMethod: string | null
  /** Date de la PREMIÈRE ligne rencontrée (la plus récente, la liste étant triée desc). */
  date: string
  /** Somme des montants des lignes du groupe. */
  amount: number
  lines: Transaction[]
  /** Auteur réel de l'opération (même sur toutes les lignes d'un panier) — `null` si non chargé côté serveur. */
  createdBy: { id: string; name: string | null; role: string | null } | null
}

export function groupTransactionsByOperation(transactions: Transaction[]): OperationGroup[] {
  const groups: OperationGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const tx of transactions) {
    // Repli sur l'id de la transaction elle-même si operation_id manque
    // (ne devrait plus arriver depuis le backfill, gardé par robustesse) —
    // chaque transaction reste alors son propre groupe à une ligne.
    const key = tx.operation_id ?? tx.id
    const existingIndex = indexByKey.get(key)

    if (existingIndex !== undefined) {
      const group = groups[existingIndex]
      group.lines.push(tx)
      group.amount += tx.amount ?? 0
    } else {
      indexByKey.set(key, groups.length)
      groups.push({
        operationId: key,
        operationCode: tx.operation_code ?? null,
        type: tx.type,
        paymentMethod: tx.payment_method ?? null,
        date: tx.date,
        amount: tx.amount ?? 0,
        lines: [tx],
        createdBy: tx.createdBy ?? null,
      })
    }
  }

  return groups
}

/** Libellé d'une transaction ISOLÉE (vente/dépense à une ligne, apport, retrait). */
export function singleLineTitle(tx: Transaction, t: TranslateFn): string {
  if (tx.type === 'expense') return tx.name
  const visual = getTransactionVisual(tx.type)
  if (tx.type === 'apport' || tx.type === 'retrait' || visual.kind === 'other') {
    // Le nom brut ("Apport de fonds", "Retrait") vient du backend en
    // français — toujours passer par la clé traduite plutôt que de
    // l'afficher tel quel (règle i18n du projet).
    return t(visual.labelKey)
  }
  const parts = [tx.article_name || tx.name]
  if (tx.variation_name) parts.push(tx.variation_name)
  let title = parts.join(' · ')
  if (tx.quantity && tx.quantity > 1) title += ` ×${tx.quantity}`
  return title
}

/**
 * Libellé d'une opération (une ou plusieurs lignes) pour la liste — "Robe
 * wax ×2, Sac raphia…" pour un petit panier, "3 articles" au-delà de 2
 * lignes (évite un libellé interminable sur une ligne de liste étroite).
 */
export function operationGroupTitle(group: OperationGroup, t: TranslateFn): string {
  if (group.lines.length === 1) {
    return singleLineTitle(group.lines[0], t)
  }

  const visual = getTransactionVisual(group.type)
  if (visual.kind !== 'sale') {
    // Dépense/apport/retrait à plusieurs lignes : ne devrait pas arriver en
    // pratique (seule une vente peut être un panier), gardé par robustesse.
    return t('wallet.list.articlesCount', { count: group.lines.length })
  }

  if (group.lines.length > 2) {
    return t('wallet.list.articlesCount', { count: group.lines.length })
  }

  return group.lines
    .map((line) => {
      const name = line.article_name || line.name
      return line.quantity && line.quantity > 1 ? `${name} ×${line.quantity}` : name
    })
    .join(', ')
}
