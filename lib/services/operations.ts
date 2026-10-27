import api from '../api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'
import { translate } from '../i18n/translate'
import { getCurrentLanguage } from '../i18n/current-language'
import type { ApiResponse, TransactionPaymentMethod } from './transactions'

function t(key: string, params?: Record<string, string | number>): string {
  return translate(key, getCurrentLanguage(), params)
}

/** Une ligne d'opération retournée par l'API Laravel (POST/GET /api/operations). */
export interface ApiOperationLine {
  id: string
  article_id?: string | null
  variable_id?: string | null
  invoice_id?: string | null
  name: string
  quantity?: number | null
  amount: number
  sale_price?: number | null
  type: string
  article?: { id: string; name: string; [key: string]: unknown } | null
  variation?: { id: string; name: string; [key: string]: unknown } | null
}

/** Opération (panier) retournée par l'API Laravel. */
export interface ApiOperation {
  id: string
  user_id: string
  created_by_user_id?: string | null
  type: string
  code: string
  payment_method?: string | null
  total_amount: number
  amount_received?: number | null
  change_given?: number | null
  client_id?: string | null
  client?: { id: string; name: string } | null
  invoice_id?: string | null
  note?: string | null
  occurred_at: string
  created_at: string
  updated_at: string
  transactions: ApiOperationLine[]
}

export interface OperationLine {
  id: string
  articleId: string | null
  variationId: string | null
  name: string
  articleName: string | null
  variationName: string | null
  quantity: number | null
  unitPrice: number | null
  amount: number
}

/** Opération formatée pour l'affichage frontend. */
export interface Operation {
  id: string
  type: string
  code: string
  paymentMethod: TransactionPaymentMethod | null
  totalAmount: number
  amountReceived: number | null
  changeGiven: number | null
  clientId: string | null
  clientName: string | null
  invoiceId: string | null
  note: string | null
  date: string
  lines: OperationLine[]
}

function mapApiOperation(api: ApiOperation): Operation {
  return {
    id: api.id,
    type: api.type,
    code: api.code,
    paymentMethod: (api.payment_method as TransactionPaymentMethod) ?? null,
    totalAmount: Number(api.total_amount) || 0,
    amountReceived: api.amount_received != null ? Number(api.amount_received) : null,
    changeGiven: api.change_given != null ? Number(api.change_given) : null,
    clientId: api.client_id ?? null,
    clientName: api.client?.name ?? null,
    invoiceId: api.invoice_id ?? null,
    note: api.note ?? null,
    date: api.occurred_at || api.created_at,
    lines: (api.transactions || []).map((line) => ({
      id: line.id,
      articleId: line.article_id ?? null,
      variationId: line.variable_id ?? null,
      name: line.name,
      articleName: line.article?.name ?? null,
      variationName: line.variation?.name ?? null,
      quantity: line.quantity ?? null,
      unitPrice: line.sale_price != null ? Number(line.sale_price) : null,
      amount: Number(line.amount) || 0,
    })),
  }
}

/** Une ligne de panier (POST /api/operations, type=sale). */
export interface SaleLinePayload {
  article_id: string
  variation_id?: string | null
  quantity: number
  unit_price: number
}

export interface CreateSaleOperationPayload {
  type: 'sale'
  payment_method: TransactionPaymentMethod
  occurred_at?: string
  client_id?: string | null
  note?: string
  amount_received?: number
  lines: SaleLinePayload[]
}

export interface CreateFlatOperationPayload {
  type: 'expense' | 'apport' | 'retrait'
  payment_method?: TransactionPaymentMethod
  note?: string
  lines: Array<{
    amount: number
    name?: string
    funding_source?: string | null
    collaborator_id?: string | null
    note?: string | null
  }>
}

export type CreateOperationPayload = CreateSaleOperationPayload | CreateFlatOperationPayload

export class OperationStockError extends Error {
  lines: Array<{ index: number; name: string; available: number; requested: number }>
  constructor(message: string, lines: Array<{ index: number; name: string; available: number; requested: number }>) {
    super(message)
    this.name = 'OperationStockError'
    this.lines = lines
  }
}

export class OperationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OperationValidationError'
  }
}

function handleOperationError(error: unknown): never {
  if (isSilentError(error)) throw error

  const axiosError = error as AxiosError<{ message?: string; lines?: Array<{ index: number; name: string; available: number; requested: number }> }>

  if (axiosError.response?.status === 401) {
    throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
  }

  if (axiosError.response?.status === 422) {
    const data = axiosError.response.data
    if (data?.lines) {
      throw new OperationStockError(data.message || t('wallet.checkout.errors.stock'), data.lines)
    }
    throw new OperationValidationError(data?.message || t('wallet.checkout.errors.validation'))
  }

  if (axiosError.response?.status === 500) {
    if (process.env.NODE_ENV !== 'production') {
      console.error("Erreur serveur lors de la création de l'opération:", axiosError.response.data)
    }
    throw new Error(t('wallet.checkout.errors.server'))
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error("Erreur lors de la création de l'opération:", error)
  }
  throw new Error(axiosError.response?.data?.message || t('wallet.checkout.errors.generic'))
}

/**
 * Crée une opération (POST /api/operations) — panier de vente multi-lignes,
 * ou dépense/apport/retrait à une seule ligne. L'Idempotency-Key est
 * OBLIGATOIRE côté serveur (contrairement à l'ancien /api/transactions) :
 * générée une seule fois à l'ouverture de l'encaissement et conservée pour
 * tous les essais de CETTE soumission (voir lib/stores/cart.ts).
 */
export async function createOperation(payload: CreateOperationPayload, idempotencyKey: string): Promise<Operation> {
  try {
    const response = await api.post<ApiResponse<ApiOperation>>('/api/operations', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })
    if (!response.data.data) {
      throw new Error(t('wallet.checkout.errors.invalidResponse'))
    }
    return mapApiOperation(response.data.data)
  } catch (error) {
    handleOperationError(error)
  }
}

export interface OperationSearchParams {
  q?: string
  type?: 'sale' | 'expense' | 'apport' | 'retrait'
  from?: string
  to?: string
  page?: number
  per_page?: number
}

export interface OperationSearchMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface OperationSearchResult {
  operations: Operation[]
  meta: OperationSearchMeta
}

export async function getOperations(params?: OperationSearchParams): Promise<OperationSearchResult> {
  try {
    const response = await api.get<ApiResponse<ApiOperation[]> & { meta?: OperationSearchMeta }>('/api/operations', {
      params,
    })
    const raw = response.data.data
    const operations = Array.isArray(raw) ? raw.map(mapApiOperation) : []
    const meta = response.data.meta ?? {
      total: operations.length,
      page: 1,
      per_page: Math.max(operations.length, 1),
      total_pages: 1,
    }
    return { operations, meta }
  } catch (error) {
    if (isSilentError(error)) throw error
    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la récupération des opérations:', error)
    }
    throw new Error(t('wallet.checkout.errors.loadList'))
  }
}

export async function getOperation(id: string): Promise<Operation> {
  try {
    const response = await api.get<ApiResponse<ApiOperation>>(`/api/operations/${id}`)
    if (!response.data.data) {
      throw new Error(t('wallet.checkout.errors.invalidResponse'))
    }
    return mapApiOperation(response.data.data)
  } catch (error) {
    if (isSilentError(error)) throw error
    throw new Error(t('wallet.checkout.errors.loadList'))
  }
}

/** DELETE /api/operations/{id} — soft delete de l'opération ET de toutes ses lignes. */
export async function deleteOperation(id: string): Promise<void> {
  try {
    await api.delete<ApiResponse<unknown>>(`/api/operations/${id}`)
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string; invoice_id?: string }>

    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
    }
    if (axiosError.response?.status === 403) {
      throw new Error(axiosError.response?.data?.message || t('transactions.serviceErrors.notAuthorizedDelete'))
    }
    if (axiosError.response?.status === 404) {
      throw new Error(t('transactions.errors.transactionNotFound'))
    }
    if (axiosError.response?.status === 422) {
      throw new Error(axiosError.response?.data?.message || t('transactions.serviceErrors.linkedToInvoice'))
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error("Erreur lors de la suppression de l'opération:", error)
    }
    throw new Error(t('transactions.serviceErrors.deleteFailed'))
  }
}

/** POST /api/operations/{id}/restore */
export async function restoreOperation(id: string): Promise<Operation> {
  try {
    const response = await api.post<ApiResponse<ApiOperation>>(`/api/operations/${id}/restore`)
    if (!response.data.data) {
      throw new Error(t('wallet.checkout.errors.invalidResponse'))
    }
    return mapApiOperation(response.data.data)
  } catch (error) {
    if (isSilentError(error)) throw error
    throw new Error(t('transactions.serviceErrors.restoreFailed'))
  }
}
