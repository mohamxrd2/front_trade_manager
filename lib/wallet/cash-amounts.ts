/**
 * Boutons "Billet reçu" de l'encaissement espèces — calculés à partir du
 * total, jamais saisis. Échelle fixe de montants ronds couramment utilisés
 * en FCFA : paliers de 5 000 jusqu'à 25 000, puis paliers de 50 000 au-delà
 * (un caissier qui n'a que de grosses coupures ne doit pas se voir proposer
 * une longue liste de paliers intermédiaires serrés).
 *
 * Exemple du cahier des charges : total = 18 500 F → [20 000, 25 000, 50 000].
 * Un montant n'apparaît que s'il est STRICTEMENT supérieur au total ("juste
 * au-dessus" — le montant exact n'a pas besoin de bouton, voir le cas
 * "espèces sans billet sélectionné" dans wallet/new/page.tsx).
 */
const LADDER = [5000, 10000, 15000, 20000, 25000, 50000, 100000, 200000, 500000, 1000000]

export function suggestCashAmounts(total: number, count = 3): number[] {
  if (total < 0 || !Number.isFinite(total)) return []
  return LADDER.filter((amount) => amount > total).slice(0, count)
}

/**
 * Monnaie à rendre — TOUJOURS calculée, jamais saisie. `amountReceived` à
 * `null` = aucun billet touché = payé au montant exact (même défaut que le
 * serveur quand amount_received n'est pas envoyé) : monnaie = 0.
 */
export function computeChange(amountReceived: number | null, total: number): number {
  if (amountReceived == null) return 0
  return Math.max(0, amountReceived - total)
}
