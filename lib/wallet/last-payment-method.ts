import type { TransactionPaymentMethod } from '@/lib/services/transactions'

/**
 * Dernier moyen d'encaissement utilisé — "mémorisé sur l'appareil" (spec) :
 * localStorage, PAS sessionStorage comme le panier lui-même (lib/stores/cart.ts) —
 * doit survivre à la fermeture de l'onglet/du navigateur, contrairement au
 * panier en cours.
 */
const STORAGE_KEY = 'waelly-last-payment-method'

export function readLastPaymentMethod(): TransactionPaymentMethod | null {
  if (typeof window === 'undefined') return null
  try {
    return (window.localStorage.getItem(STORAGE_KEY) as TransactionPaymentMethod | null) ?? null
  } catch {
    return null
  }
}

export function writeLastPaymentMethod(method: TransactionPaymentMethod): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, method)
  } catch {
    // Best-effort — un navigateur en navigation privée peut refuser l'écriture.
  }
}
