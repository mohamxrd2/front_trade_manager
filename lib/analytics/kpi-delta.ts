/**
 * Variation d'un indicateur KPI (carte Analyses) — pure, sans React/i18n
 * direct (le texte "flat"/"new" et le formateur de pourcentage sont
 * injectés), pour rester testable sans jsdom.
 *
 * Corrige deux défauts d'affichage :
 * - double flèche : <KpiCard> affiche déjà sa propre icône flèche ; ce
 *   module ne doit JAMAIS inclure de caractère flèche dans `text`.
 * - flèche verte trompeuse à 0% : une variation nulle, ou une période
 *   précédente vide, affiche "flat"/"new" SANS flèche (`showArrow: false`)
 *   plutôt qu'une flèche verte à 0%.
 */
export interface KpiDeltaResult {
  text: string
  trend: 'up' | 'down'
  /** Vert si true, rouge si false — dépend de `goodWhenIncreasing`, PAS seulement du sens de la variation (ex. une baisse des dépenses est positive). */
  positive: boolean
  /** false pour les états "flat"/"new" — <KpiCard> ne doit alors afficher AUCUNE icône flèche. */
  showArrow: boolean
}

export function computeKpiDelta(
  current: number,
  previous: number,
  changePercent: number,
  goodWhenIncreasing: boolean,
  formatPercent: (n: number) => string,
  labels: { flat: string; new: string },
  suffix?: string
): KpiDeltaResult {
  if (previous === 0) {
    if (current === 0) {
      return { text: labels.flat, trend: 'up', positive: true, showArrow: false }
    }
    // Pas de période précédente à comparer : "Nouveau", jamais une fausse
    // variation de +100 % avec flèche verte.
    return { text: labels.new, trend: 'up', positive: true, showArrow: false }
  }

  if (changePercent === 0) {
    return { text: labels.flat, trend: 'up', positive: true, showArrow: false }
  }

  const trend: 'up' | 'down' = changePercent > 0 ? 'up' : 'down'
  const positive = goodWhenIncreasing ? trend === 'up' : trend === 'down'
  const text = `${formatPercent(Math.abs(changePercent))} %${suffix ? ` ${suffix}` : ''}`

  return { text, trend, positive, showArrow: true }
}
