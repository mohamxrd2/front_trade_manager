/**
 * Statut de stock affiché (badge) d'une variation ou d'un article.
 *
 * Le serveur calcule `low_stock` à partir du POURCENTAGE VENDU (vendus ÷
 * quantité ≥ seuil). Un produit à 0 en stock jamais vendu a 0 % vendu : il
 * n'était donc pas « faible » et s'affichait « Disponible ». Ici, le stock
 * restant passe en premier : plus rien en stock = rupture, quoi qu'il arrive.
 */

export type StockStatus = 'out' | 'low' | 'available'

interface StockLike {
  remaining_quantity: number
  low_stock: boolean
}

export function variationStockStatus(variation: StockLike): StockStatus {
  if (Number(variation.remaining_quantity) <= 0) return 'out'
  return variation.low_stock ? 'low' : 'available'
}

/**
 * Article : rupture s'il ne reste rien (toutes ses variantes à 0 pour un
 * article à variantes) ; stock faible si l'article est sous son seuil ou si
 * une de ses variantes est faible ou en rupture (l'agrégat peut le masquer).
 */
export function articleStockStatus(article: StockLike & { type?: string; variations?: StockLike[] }): StockStatus {
  const variations = article.type === 'variable' ? (article.variations ?? []) : []
  const remaining = variations.length > 0 ? variations.reduce((sum, v) => sum + Math.max(0, Number(v.remaining_quantity)), 0) : Number(article.remaining_quantity)
  if (remaining <= 0) return 'out'
  if (article.low_stock || variations.some((v) => variationStockStatus(v) !== 'available')) return 'low'
  return 'available'
}
