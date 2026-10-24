import dayjs from 'dayjs'
import 'dayjs/locale/fr'

import type { Transaction } from '@/lib/services/transactions'

dayjs.locale('fr')

function formatAmount(n: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} F`
}

/**
 * Ligne de résumé affichée dans la confirmation de suppression, ex.
 * « Robe wax · Taille M ×2 — 25 000 F, le 24/10 à 14:32 ». Pure fonction
 * (pas de hook) pour rester testable sans contexte React/Query.
 */
export function formatTransactionSummary(t: Transaction): string {
  const parts: string[] = []
  if (t.type === 'sale') {
    parts.push(t.article_name || t.name)
    if (t.variation_name) parts.push(t.variation_name)
  } else {
    parts.push(t.name)
  }
  let title = parts.join(' · ')
  if (t.type === 'sale' && t.quantity && t.quantity > 1) title += ` ×${t.quantity}`

  const amount = formatAmount(t.amount ?? 0)
  const when = dayjs(t.date).format('D/MM [à] HH:mm')
  return `${title} — ${amount}, le ${when}`
}

/**
 * Conséquence affichée sous le résumé. `remainingAfterRestore` est déjà
 * calculé par l'appelant (useDeletionConsequence) : stock actuel de
 * l'article/variation + quantité de CETTE vente (puisque la supprimer
 * retire sa quantité de la somme des ventes, le stock remonte d'autant).
 * `null` quand l'article/variation n'a pas pu être résolu (ex. article déjà
 * supprimé) — la phrase retombe alors sur une formulation générique.
 */
export function describeDeletionConsequence(t: Transaction, remainingAfterRestore: number | null): string {
  if (t.type === 'expense') {
    return `Le solde augmentera de ${formatAmount(t.amount ?? 0)}.`
  }

  const targetName = t.variation_name || t.article_name || t.name
  if (remainingAfterRestore === null) {
    return `Le stock de ${targetName} sera mis à jour.`
  }
  return `Le stock de ${targetName} reviendra à ${remainingAfterRestore}.`
}
