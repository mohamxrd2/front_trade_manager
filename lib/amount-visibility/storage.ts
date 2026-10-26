/**
 * Persistance du réglage « montants masqués » (localStorage, clé unique,
 * valeur globale — pas par écran). Toujours entouré de try/catch : navigation
 * privée, quota dépassé, ou tout simplement `window` absent (rendu serveur)
 * ne doivent jamais faire planter l'app — repli silencieux sur « visible ».
 */
const STORAGE_KEY = 'waelly-amounts-hidden'

/** Par défaut (stockage absent/indisponible/illisible) : montants VISIBLES. */
export function readStoredAmountsHidden(): boolean {
  try {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeStoredAmountsHidden(hidden: boolean): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0')
  } catch {
    // Stockage indisponible (navigation privée, quota…) — le réglage reste
    // actif pour la session en cours (état React), simplement pas persisté.
  }
}
