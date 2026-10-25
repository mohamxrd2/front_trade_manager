import type { Transaction } from '@/lib/services/transactions'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { formatNumber, formatDate } from '@/lib/i18n/format'
import { translate } from '@/lib/i18n/translate'

function formatAmount(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 0 })} F`
}

/**
 * Ligne de résumé affichée dans la confirmation de suppression, ex.
 * « Robe wax · Taille M ×2 — 25 000 F, le 24/10 à 14:32 ». Pure fonction
 * (pas de hook) pour rester testable sans contexte React/Query — reçoit
 * `language` en paramètre plutôt que de lire un contexte React.
 */
export function formatTransactionSummary(transaction: Transaction, language: AppLanguage): string {
  const parts: string[] = []
  if (transaction.type === 'sale') {
    parts.push(transaction.article_name || transaction.name)
    if (transaction.variation_name) parts.push(transaction.variation_name)
  } else {
    parts.push(transaction.name)
  }
  let title = parts.join(' · ')
  if (transaction.type === 'sale' && transaction.quantity && transaction.quantity > 1) title += ` ×${transaction.quantity}`

  const amount = formatAmount(transaction.amount ?? 0, language)
  const when =
    language === 'en'
      ? `on ${formatDate(transaction.date, language, 'M/D [at] h:mm A')}`
      : `le ${formatDate(transaction.date, language, 'D/MM [à] HH:mm')}`
  return `${title} — ${amount}, ${when}`
}

/**
 * Conséquence affichée sous le résumé. `remainingAfterRestore` est déjà
 * calculé par l'appelant (useDeletionConsequence) : stock actuel de
 * l'article/variation + quantité de CETTE vente (puisque la supprimer
 * retire sa quantité de la somme des ventes, le stock remonte d'autant).
 * `null` quand l'article/variation n'a pas pu être résolu (ex. article déjà
 * supprimé) — la phrase retombe alors sur une formulation générique.
 */
export function describeDeletionConsequence(
  transaction: Transaction,
  remainingAfterRestore: number | null,
  language: AppLanguage
): string {
  if (transaction.type === 'expense') {
    return translate('transactions.summary.balanceIncreasesBy', language, {
      amount: formatAmount(transaction.amount ?? 0, language),
    })
  }

  const targetName = transaction.variation_name || transaction.article_name || transaction.name
  if (remainingAfterRestore === null) {
    return translate('transactions.summary.stockWillUpdate', language, { name: targetName })
  }
  return translate('transactions.summary.stockWillReturnTo', language, {
    name: targetName,
    quantity: remainingAfterRestore,
  })
}
