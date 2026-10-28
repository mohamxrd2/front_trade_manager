/**
 * Arrondit une liste de pourcentages (déjà calculés, ex. part de chaque
 * moyen de paiement dans le CA) à l'entier le plus proche en garantissant
 * que la somme reste EXACTEMENT 100 — l'arrondi naïf (chaque valeur arrondie
 * indépendamment) peut sommer à 99 ou 101 avec plusieurs parts proches de
 * x.5, ce qui est visuellement faux dans un donut/tableau. L'écart est
 * absorbé par la plus grande part (la différence y est la moins visible).
 *
 * Toutes valeurs nulles (aucune donnée) : renvoie des zéros plutôt que de
 * diviser par zéro.
 */
export function roundPercentagesTo100(values: number[]): number[] {
  if (values.length === 0) return []

  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return values.map(() => 0)

  const rawPercentages = values.map((v) => (v / total) * 100)
  const rounded = rawPercentages.map((p) => Math.round(p))
  const diff = 100 - rounded.reduce((sum, p) => sum + p, 0)

  if (diff !== 0) {
    let largestIndex = 0
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[largestIndex]) largestIndex = i
    }
    rounded[largestIndex] += diff
  }

  return rounded
}
