import type { Article, Variation } from '@/lib/services/articles'
import type { CartLine } from '@/lib/stores/cart'
import { normalizeBarcode } from './validate'

/** Article (et variante) qui porte un code, trouvé dans la liste déjà chargée ou par l'API. */
export interface ScannedProduct {
  article: Article
  variation: Variation | null
}

export type ScanToCartResult =
  | { kind: 'added'; name: string; quantity: 1; lineId: string }
  | { kind: 'incremented'; name: string; quantity: number; lineId: string }
  | { kind: 'out-of-stock'; name: string }
  | { kind: 'max-reached'; name: string }

/** Un UPC-A arrive avec 12 ou 13 chiffres selon le lecteur : les deux écritures désignent le même code. */
export function equivalentCodes(code: string): string[] {
  const cleaned = normalizeBarcode(code)
  if (/^0\d{12}$/.test(cleaned)) return [cleaned, cleaned.slice(1)]
  if (/^\d{12}$/.test(cleaned)) return [cleaned, `0${cleaned}`]
  return [cleaned]
}

/** Cherche le code dans la liste d'articles déjà chargée (instantané, sans réseau). */
export function findByBarcode(articles: Article[], code: string): ScannedProduct | null {
  for (const candidate of equivalentCodes(code)) {
    for (const article of articles) {
      if (article.type === 'simple' && article.barcode === candidate) return { article, variation: null }
      const variation = article.variations?.find((v) => v.barcode === candidate)
      if (variation) return { article, variation }
    }
  }
  return null
}

/** Un article correspond-il exactement à ce code (le sien ou celui d'une de ses variantes) ? Pour la recherche. */
export function articleHasBarcode(article: Article, code: string): boolean {
  const codes = equivalentCodes(code)
  return (
    (article.barcode != null && codes.includes(article.barcode)) ||
    Boolean(article.variations?.some((v) => v.barcode != null && codes.includes(v.barcode)))
  )
}

export function scannedName(product: ScannedProduct): string {
  return product.variation ? `${product.article.name} — ${product.variation.name}` : product.article.name
}

interface CartLike {
  lines: CartLine[]
  addLine: (line: { articleId: string; variationId: string | null; articleName: string; variationName: string | null; unitPrice: number; maxStock: number }) => void
}

/**
 * Ajoute le produit scanné au panier, ou +1 s'il y est déjà — mêmes règles
 * de stock que l'ajout à la main (pas de stock : refus ; tout le stock déjà
 * au panier : refus, la quantité ne bouge pas).
 */
export function addScannedToCart(product: ScannedProduct, cart: CartLike): ScanToCartResult {
  const { article, variation } = product
  const name = scannedName(product)
  const articleId = String(article.id)
  const variationId = variation?.id ?? null
  const lineId = `${articleId}:${variationId ?? ''}`
  const stock = variation ? variation.remaining_quantity : article.remaining_quantity
  const existing = cart.lines.find((l) => l.id === lineId)

  if (stock <= 0) return { kind: 'out-of-stock', name }
  if (existing && existing.quantity >= stock) return { kind: 'max-reached', name }

  cart.addLine({
    articleId,
    variationId,
    articleName: article.name,
    variationName: variation?.name ?? null,
    unitPrice: variation ? variation.price : article.sale_price,
    maxStock: stock,
  })
  return existing
    ? { kind: 'incremented', name, quantity: existing.quantity + 1, lineId }
    : { kind: 'added', name, quantity: 1, lineId }
}
