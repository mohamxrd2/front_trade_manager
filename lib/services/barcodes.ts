import api, { type ApiError } from '../api'
import type { Article, Variation } from './articles'
import { normalizeBarcode } from '../barcode/validate'

/** Produit trouvé par son code : l'article, et la variante si c'est le code d'une variante. */
export interface BarcodeMatch {
  barcode: string
  article: Article
  variation: Variation | null
}

interface Envelope<T> {
  success: boolean
  message?: string
  data: T
}

/** GET /api/barcodes/{code} — `null` si aucun produit du compte ne porte ce code. */
export async function lookupBarcode(code: string): Promise<BarcodeMatch | null> {
  const cleaned = normalizeBarcode(code)
  if (!cleaned) return null
  try {
    const response = await api.get<Envelope<BarcodeMatch>>(`/api/barcodes/${encodeURIComponent(cleaned)}`)
    return response.data.data
  } catch (error) {
    if ((error as ApiError).status === 404) return null
    throw error
  }
}

/** Code EAN-13 interne pour un article simple sans code (jamais de remplacement). */
export async function generateArticleBarcode(articleId: string | number): Promise<string> {
  const response = await api.post<Envelope<{ barcode: string }>>(`/api/articles/${articleId}/barcode`)
  return response.data.data.barcode
}

/** Code EAN-13 interne pour une variante sans code. */
export async function generateVariationBarcode(variationId: string): Promise<string> {
  const response = await api.post<Envelope<{ barcode: string }>>(`/api/variations/${variationId}/barcode`)
  return response.data.data.barcode
}

export interface MissingBarcodesScope {
  /** Absent : tout le compte. Un article à variantes = toutes ses variantes. */
  articleIds?: Array<string | number>
  variationIds?: string[]
}

function scopeBody(scope: MissingBarcodesScope) {
  return {
    ...(scope.articleIds ? { article_ids: scope.articleIds.map(String) } : {}),
    ...(scope.variationIds ? { variation_ids: scope.variationIds } : {}),
  }
}

/** Combien de codes seraient créés (confirmation avant génération en lot). */
export async function countMissingBarcodes(scope: MissingBarcodesScope = {}): Promise<number> {
  const response = await api.post<Envelope<{ count: number }>>('/api/barcodes/generate-missing', { ...scopeBody(scope), dry_run: true })
  return response.data.data.count
}

/** Génère les codes manquants ; renvoie le nombre créé. */
export async function generateMissingBarcodes(scope: MissingBarcodesScope = {}): Promise<number> {
  const response = await api.post<Envelope<{ count: number }>>('/api/barcodes/generate-missing', scopeBody(scope))
  return response.data.data.count
}

/** Message d'erreur du serveur (déjà dans la langue de l'utilisateur) pour un code refusé, s'il y en a un. */
export function barcodeErrorMessage(error: unknown, field = 'barcode'): string | null {
  const errors = (error as { errors?: Record<string, string[] | string> } | null)?.errors
  const value = errors?.[field]
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}
