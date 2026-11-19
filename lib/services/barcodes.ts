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

export interface MissingBarcodesResult {
  count: number
  failedCount: number
  /** Produits qui n'ont pas reçu de code, et pourquoi (message déjà traduit par le serveur). */
  failed: Array<{ id: string; product: string; reason: string }>
  /** Bilan rédigé par le serveur (« 2 codes-barres créés. 1 produit n'a pas pu… »). */
  message: string
}

/**
 * Génère les codes manquants. Réussite partielle possible : les produits en
 * échec sont listés, les autres ont bien reçu leur code. Si AUCUN code n'a pu
 * être créé, le serveur répond 422 avec le même détail (lu ici aussi).
 */
export async function generateMissingBarcodes(scope: MissingBarcodesScope = {}): Promise<MissingBarcodesResult> {
  type Body = { count: number; failed_count: number; failed: MissingBarcodesResult['failed'] }
  const read = (body: { message?: string; data?: Body }): MissingBarcodesResult => ({
    count: body.data?.count ?? 0,
    failedCount: body.data?.failed_count ?? 0,
    failed: body.data?.failed ?? [],
    message: body.message ?? '',
  })
  try {
    const response = await api.post<{ message?: string; data: Body }>('/api/barcodes/generate-missing', scopeBody(scope))
    return read(response.data)
  } catch (error) {
    const apiError = error as ApiError
    const data = apiError.data as Body | undefined
    if (apiError.status === 422 && data && typeof data.failed_count === 'number') return read({ message: apiError.message, data })
    throw error
  }
}

/** Message du serveur pour une erreur (déjà traduit), s'il y en a un d'utile. */
export function serverErrorMessage(error: unknown): string | null {
  const apiError = error as ApiError | null
  if (!apiError?.status || apiError.status < 400) return null
  return barcodeErrorMessage(error) ?? apiError.message ?? null
}

/** Message d'erreur du serveur (déjà dans la langue de l'utilisateur) pour un code refusé, s'il y en a un. */
export function barcodeErrorMessage(error: unknown, field = 'barcode'): string | null {
  const errors = (error as { errors?: Record<string, string[] | string> } | null)?.errors
  const value = errors?.[field]
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}
