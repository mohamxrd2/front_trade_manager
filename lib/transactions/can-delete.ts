import type { Transaction } from '@/lib/services/transactions'

/**
 * Reflète côté UI la même règle que TransactionController::destroy() : une
 * vente liée à une facture déjà PAYÉE ne se supprime pas depuis la liste
 * (elle se gère depuis la facture). Le 422 serveur reste le filet de
 * sécurité final si le statut a changé entre l'affichage et le clic.
 */
export function isDeletableFromList(transaction: Transaction, invoiceStatus?: string | null): boolean {
  if (transaction.type !== 'sale') return true
  if (!transaction.invoice_id) return true
  return invoiceStatus !== 'paid'
}
