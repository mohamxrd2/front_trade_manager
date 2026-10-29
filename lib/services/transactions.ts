import api from '../api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'
import { translate } from '../i18n/translate'
import { getCurrentLanguage } from '../i18n/current-language'

function t(key: string, params?: Record<string, string | number>): string {
  return translate(key, getCurrentLanguage(), params)
}

/**
 * Types pour les transactions
 */

/**
 * Transaction retournée par l'API Laravel
 */
export interface ApiTransaction {
  id: string
  user_id: string
  article_id?: string | null
  variable_id?: string | null
  invoice_id?: string | null
  name: string
  quantity?: number | null
  amount: number
  sale_price?: number | null
  // `string` (pas une union stricte) : le frontend doit rester tolérant à
  // un type encore inconnu de lui (voir lib/transactions/transaction-visual.ts,
  // qui retombe sur "Opération" plutôt que de planter) — valeurs connues
  // aujourd'hui : 'sale' | 'expense' | 'apport' | 'retrait'.
  type: string
  funding_source?: string | null
  collaborator_id?: string | null
  note?: string | null
  payment_method?: string | null
  /** Étape 1/2 du chantier "paniers multi-articles" — toujours présent
   * depuis le backfill, jamais null pour une transaction créée après. */
  operation_id?: string | null
  /** Accessor appended côté Laravel (Transaction::getOperationCodeAttribute()). */
  operation_code?: string | null
  /** Chantier "Équipe" étape 3 — { id, name, role } de l'auteur réel (Transaction::getCreatedByAttribute()) ; `null` si non chargé côté serveur (voir ce commentaire backend). */
  created_by?: { id: string; name: string | null; role: string | null } | null
  created_at: string
  updated_at: string
  article?: {
    id: string
    name: string
    sale_price: string
    [key: string]: unknown
  } | null
  variation?: {
    id: string
    name: string
    [key: string]: unknown
  } | null
}

/**
 * Transaction formatée pour l'affichage frontend
 */
export interface Transaction {
  id: string
  type: string
  name: string
  quantity?: number | null
  unit_price?: number | null
  sale_price?: number | null
  amount?: number
  date: string // Format: YYYY-MM-DD
  article_id?: string | null
  variable_id?: string | null
  invoice_id?: string | null
  article_name?: string | null
  variation_name?: string | null
  funding_source?: string | null
  collaborator_id?: string | null
  note?: string | null
  payment_method?: string | null
  operation_id?: string | null
  operation_code?: string | null
  createdBy?: { id: string; name: string | null; role: string | null } | null
}

/**
 * Statistiques wallet retournées par GET /api/user
 */
export interface WalletStats {
  calculated_wallet: number // Solde actuel (ventes − dépenses, INCHANGÉ par les apports/retraits)
  total_sale: number // Total des ventes
  total_expense: number // Total des dépenses
  total_deposit?: number // Total des apports de fonds
  total_withdrawal?: number // Total des retraits du gérant
  balance?: number // Trésorerie réelle : ventes − dépenses + apports − retraits
  wallet: number // Revenu personnel
  [key: string]: unknown
}

/** Origine d'un apport de fonds. */
export type DepositFundingSource = 'apport_personnel' | 'collaborateur' | 'pret' | 'autre'

/** Moyen de paiement — partagé par apports et retraits. */
export type TransactionPaymentMethod =
  | 'especes'
  | 'orange_money'
  | 'moov_money'
  | 'wave'
  | 'mtn_money'
  | 'virement'

/**
 * Payload pour créer une dépense (POST /api/transactions, type=expense) —
 * étape 3 du chantier "paniers multi-articles" : ajoute payment_method
 * (facultatif, contrairement à l'apport/retrait — l'ancien formulaire de
 * dépense n'a jamais exigé de moyen de paiement, et ne doit pas commencer à
 * le faire pour ne pas casser les dépenses déjà en cours de saisie).
 */
export interface CreateExpensePayload {
  name: string
  amount: number
  payment_method?: TransactionPaymentMethod
}

/**
 * Payload pour créer un apport de fonds (POST /api/transactions, type=apport)
 */
export interface CreateDepositPayload {
  amount: number
  funding_source: DepositFundingSource
  /** Requis uniquement si funding_source === 'collaborateur'. */
  collaborator_id?: string | null
  payment_method: TransactionPaymentMethod
  note?: string
  /** ISO 8601 — absent : le serveur date à "maintenant". */
  date?: string
}

/**
 * Payload pour créer un retrait (POST /api/transactions, type=retrait)
 */
export interface CreateWithdrawalPayload {
  amount: number
  payment_method: TransactionPaymentMethod
  note?: string
  date?: string
}

/**
 * Payload pour modifier une vente (PUT /api/transactions/{id})
 * Note: amount est calculé automatiquement côté backend (amount = sale_price * quantity)
 * Les champs quantity et sale_price sont optionnels (au moins un doit être présent)
 */
export interface UpdateSalePayload {
  name: string // Nom de la transaction (requis)
  quantity?: number // Optionnel : seulement si modifié
  sale_price?: number // Optionnel : seulement si modifié
  // amount n'est pas nécessaire car calculé côté backend
}

/**
 * Payload pour modifier une dépense (PUT /api/transactions/{id})
 */
export interface UpdateExpensePayload {
  name: string
  amount: number
}

/**
 * Réponse API standard
 */
export interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * Erreurs de validation
 */
export interface ValidationErrors {
  [field: string]: string[]
}

/**
 * Convertit une transaction API en transaction frontend
 */
function mapApiTransactionToTransaction(apiTransaction: ApiTransaction): Transaction {
  // Utiliser created_at pour la date (format ISO)
  const dateString = apiTransaction.created_at || apiTransaction.updated_at || new Date().toISOString()

  // Laravel sérialise les colonnes `decimal` (amount, sale_price) en
  // chaînes JSON ("25000.00"), pas en nombres, malgré le typage TS côté
  // API — sans ce Number(), additionner plusieurs montants concatène des
  // chaînes au lieu de les sommer (NaN dès qu'on agrège plus d'une
  // transaction, ex. le CA sur 30 jours).
  const salePrice = apiTransaction.sale_price != null ? Number(apiTransaction.sale_price) : null
  const amount = Number(apiTransaction.amount)

  return {
    id: apiTransaction.id,
    type: apiTransaction.type,
    name: apiTransaction.name,
    quantity: apiTransaction.quantity ?? null,
    unit_price: salePrice, // Alias pour compatibilité
    sale_price: salePrice, // Prix unitaire pour les ventes
    amount: Number.isNaN(amount) ? 0 : amount,
    date: dateString, // Format ISO pour dayjs
    article_id: apiTransaction.article_id ?? null,
    variable_id: apiTransaction.variable_id ?? null,
    invoice_id: apiTransaction.invoice_id ?? null,
    article_name: apiTransaction.article?.name ?? null,
    variation_name: apiTransaction.variation?.name ?? null,
    funding_source: apiTransaction.funding_source ?? null,
    collaborator_id: apiTransaction.collaborator_id ?? null,
    note: apiTransaction.note ?? null,
    payment_method: apiTransaction.payment_method ?? null,
    operation_id: apiTransaction.operation_id ?? null,
    operation_code: apiTransaction.operation_code ?? null,
    createdBy: apiTransaction.created_by ?? null,
  }
}

/**
 * Récupère les statistiques wallet depuis GET /api/user
 */
export async function getWalletStats(): Promise<WalletStats> {
  try {
    const response = await api.get<WalletStats>('/api/user')
    return response.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      // Redirection vers /login gérée par l'intercepteur axios
      throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la récupération des statistiques:', axiosError.response.data)
      }
      throw new Error(t('transactions.serviceErrors.serverErrorStats'))
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la récupération des statistiques:', error)
    }
    throw new Error(t('transactions.serviceErrors.loadStatsFailed'))
  }
}

/**
 * Récupère la liste des transactions depuis GET /api/transactions
 */
export async function getTransactions(): Promise<Transaction[]> {
  try {
    const response = await api.get<ApiResponse<ApiTransaction[]>>('/api/transactions')
    
    // Normaliser la réponse : peut être { data: [...] } ou directement [...]
    const transactions = response.data.data || (Array.isArray(response.data) ? response.data : [])
    
    if (!Array.isArray(transactions)) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Réponse API transactions non valide:', transactions)
      }
      return []
    }

    // Mapper les transactions
    const mappedTransactions = transactions.map(mapApiTransactionToTransaction)
    
    // Trier par date décroissante (plus récent au plus ancien)
    return mappedTransactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA // Ordre décroissant
    })
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      // Redirection vers /login gérée par l'intercepteur axios
      throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la récupération des transactions:', axiosError.response.data)
      }
      throw new Error(t('transactions.serviceErrors.serverErrorList'))
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la récupération des transactions:', error)
    }
    throw new Error(t('transactions.serviceErrors.loadListFailed'))
  }
}

/**
 * Paramètres de recherche/filtre pour GET /api/transactions — voir
 * TransactionController::index(). Tous optionnels : passer un objet vide
 * revient au comportement de getTransactions() (liste complète).
 */
export interface TransactionSearchParams {
  q?: string
  type?: 'sale' | 'expense' | 'apport' | 'retrait'
  /** Déeplink depuis Analyses ("Encaissements par moyen de paiement") — voir lib/payments/methods.ts pour les valeurs possibles. */
  payment_method?: string
  date_from?: string // AAAA-MM-JJ
  date_to?: string // AAAA-MM-JJ
  /** Filtre "Vendeur" (chantier "Équipe" §7) — id du membre, nécessite sales.view_all côté serveur. */
  created_by?: string
  page?: number
  per_page?: number
}

export interface TransactionSearchMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface TransactionSearchResult {
  transactions: Transaction[]
  meta: TransactionSearchMeta
}

/**
 * Recherche/filtre paginée (GET /api/transactions avec q/type/date_from/
 * date_to/page/per_page) — utilisée par le Portefeuille (barre de
 * recherche). Distincte de getTransactions() : clé TanStack Query séparée
 * (voir keys.transactions.search()), ne touche pas au cache partagé avec le
 * Tableau de bord (keys.transactions.list(), toujours la liste complète).
 */
export async function searchTransactions(params: TransactionSearchParams): Promise<TransactionSearchResult> {
  try {
    const response = await api.get<ApiResponse<ApiTransaction[]> & { meta?: TransactionSearchMeta }>(
      '/api/transactions',
      { params }
    )

    const rawTransactions = response.data.data
    const transactions = Array.isArray(rawTransactions) ? rawTransactions.map(mapApiTransactionToTransaction) : []
    const meta = response.data.meta ?? {
      total: transactions.length,
      page: 1,
      per_page: Math.max(transactions.length, 1),
      total_pages: 1,
    }

    return { transactions, meta }
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>

    if (isSilentError(error)) {
      throw error
    }

    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
    }

    if (axiosError.response?.status === 422) {
      const firstError = Object.values(axiosError.response.data?.errors ?? {})[0]?.[0]
      throw new Error(firstError || t('transactions.serviceErrors.searchInvalid'))
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la recherche de transactions:', axiosError.response.data)
      }
      throw new Error(t('transactions.serviceErrors.serverErrorList'))
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la recherche de transactions:', error)
    }
    throw new Error(t('transactions.serviceErrors.loadListFailed'))
  }
}

/**
 * Modifie une transaction (PUT /api/transactions/{id})
 */
export async function updateTransaction(
  id: string,
  payload: UpdateSalePayload | UpdateExpensePayload
): Promise<Transaction> {
  try {
    // Union non discriminée : quantity/sale_price n'existent que sur
    // UpdateSalePayload, amount seulement sur UpdateExpensePayload — accès
    // sûr via un type élargi, sans changer le comportement runtime (accès
    // à un champ absent reste `undefined`, comme avant).
    const payloadFields = payload as Partial<UpdateSalePayload & UpdateExpensePayload>

    // S'assurer que le payload est bien formaté
    const formattedPayload = {
      ...payload,
      // S'assurer que les nombres sont bien des nombres et non des strings
      ...(payloadFields.quantity !== undefined && { quantity: Number(payloadFields.quantity) }),
      ...(payloadFields.sale_price !== undefined && { sale_price: Number(payloadFields.sale_price) }),
      ...(payloadFields.amount !== undefined && { amount: Number(payloadFields.amount) }),
    };
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('📤 Envoi PUT /api/transactions/' + id, formattedPayload)
    }

    const response = await api.put<ApiResponse<ApiTransaction>>(`/api/transactions/${id}`, formattedPayload)

    if (process.env.NODE_ENV !== 'production') {
      console.debug('📥 Réponse API:', response.data)
    }

    if (!response.data.data) {
      throw new Error(t('transactions.serviceErrors.invalidApiResponse'))
    }

    return mapApiTransactionToTransaction(response.data.data)
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<unknown> | { message?: string }>

    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
    }

    if (axiosError.response?.status === 400) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur 400 - Bad Request:', axiosError.response.data)
      }
      const message = (axiosError.response.data as { message?: string })?.message || t('transactions.serviceErrors.updateFailedGeneric')
      throw new Error(message)
    }

    if (axiosError.response?.status === 422) {
      const responseData = axiosError.response.data as Record<string, unknown> | undefined;

      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur 422 - Validation:', responseData)
      }

      // Essayer différents formats d'erreurs possibles
      const errors = responseData?.errors || responseData?.error || responseData?.message || responseData;

      // Si errors est un objet avec des clés, c'est le format attendu
      if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
        const errorsObj = errors as Record<string, unknown>
        // Vérifier si c'est un objet d'erreurs Laravel (clé: [messages])
        const hasLaravelFormat = Object.keys(errorsObj).some(key => Array.isArray(errorsObj[key]));
        if (hasLaravelFormat) {
          throw { validationErrors: errorsObj }
        }

        // Si errors a des clés mais pas de format Laravel, essayer de les convertir
        if (Object.keys(errorsObj).length > 0) {
          const convertedErrors: Record<string, string[]> = {};
          Object.keys(errorsObj).forEach(key => {
            const value = errorsObj[key];
            if (Array.isArray(value)) {
              convertedErrors[key] = value;
            } else if (typeof value === 'string') {
              convertedErrors[key] = [value];
            } else {
              convertedErrors[key] = [String(value)];
            }
          });
          throw { validationErrors: convertedErrors }
        }
      }

      // Si errors est un message string, le convertir en format d'erreur
      if (typeof errors === 'string') {
        throw { validationErrors: { _general: [errors] } }
      }

      // Si responseData.message existe, l'utiliser
      if (responseData?.message) {
        throw { validationErrors: { _general: [responseData.message] } }
      }

      // Dernier recours : erreur générique
      throw {
        validationErrors: {
          _general: [t('transactions.serviceErrors.validationGeneric')]
        }
      }
    }

    if (axiosError.response?.status === 404) {
      throw new Error(t('transactions.errors.transactionNotFound'))
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la modification:', axiosError.response.data)
      }
      throw new Error(t('transactions.serviceErrors.serverErrorUpdate'))
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la modification de la transaction:', error)
    }
    throw new Error(t('transactions.serviceErrors.updateFailed'))
  }
}

/**
 * Supprime une transaction (DELETE /api/transactions/{id}, soft delete côté
 * serveur — restaurable via restoreTransaction() ci-dessous).
 */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    await api.delete<ApiResponse<unknown>>(`/api/transactions/${id}`)
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
      // Vente liée à une facture payée : le serveur reste le filet de
      // sécurité final (le frontend masque déjà le bouton Supprimer dans ce
      // cas, voir TransactionDetailSheet / TransactionDetailsDialog), mais
      // une facture a pu être payée entre l'ouverture de l'écran et le clic.
      throw new Error(axiosError.response?.data?.message || t('transactions.serviceErrors.linkedToInvoice'))
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la suppression:', axiosError.response.data)
      }
      throw new Error(t('transactions.serviceErrors.serverErrorDelete'))
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la suppression de la transaction:', error)
    }
    throw new Error(t('transactions.serviceErrors.deleteFailed'))
  }
}

/**
 * Restaure une transaction supprimée (POST /api/transactions/{id}/restore) —
 * utilisé par le bouton « Annuler » du toast de suppression.
 */
export async function restoreTransaction(id: string): Promise<Transaction> {
  try {
    const response = await api.post<ApiResponse<ApiTransaction>>(`/api/transactions/${id}/restore`)

    if (!response.data.data) {
      throw new Error(t('transactions.serviceErrors.invalidApiResponse'))
    }

    return mapApiTransactionToTransaction(response.data.data)
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>

    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
    }

    if (axiosError.response?.status === 403) {
      throw new Error(axiosError.response?.data?.message || t('transactions.serviceErrors.notAuthorizedRestore'))
    }

    if (axiosError.response?.status === 404) {
      throw new Error(t('transactions.errors.transactionNotFound'))
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la restauration de la transaction:', error)
    }
    throw new Error(t('transactions.serviceErrors.restoreFailed'))
  }
}

/**
 * Erreur de validation 422 avec les erreurs par champ (format Laravel) —
 * utilisée par le formulaire Apport/Retrait pour afficher un message précis
 * sous le bon champ plutôt qu'un toast générique.
 */
export class TransactionValidationError extends Error {
  validationErrors: ValidationErrors
  constructor(message: string, validationErrors: ValidationErrors) {
    super(message)
    this.name = 'TransactionValidationError'
    this.validationErrors = validationErrors
  }
}

function handleDepositWithdrawalError(error: unknown): never {
  if (isSilentError(error)) {
    throw error
  }

  const axiosError = error as AxiosError<{ message?: string; errors?: ValidationErrors }>

  if (axiosError.response?.status === 401) {
    throw new Error('Non authentifié') // i18n:allow — sentinelle interne, testée via .includes() ailleurs, jamais affichée telle quelle
  }

  if (axiosError.response?.status === 422) {
    const errors = axiosError.response.data?.errors || {}
    const message = axiosError.response.data?.message || Object.values(errors)[0]?.[0] || t('transactions.serviceErrors.validationGeneric')
    throw new TransactionValidationError(message, errors)
  }

  if (axiosError.response?.status === 500) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur serveur lors de la création de l\'opération:', axiosError.response.data)
    }
    throw new Error(t('transactions.serviceErrors.serverErrorCreate'))
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('Erreur lors de la création de l\'opération:', error)
  }
  throw new Error(axiosError.response?.data?.message || t('transactions.serviceErrors.createFailed'))
}

/**
 * Crée une dépense (POST /api/transactions, type=expense) — mêmes garanties
 * d'idempotence que createDeposit()/createWithdrawal().
 */
export async function createExpense(payload: CreateExpensePayload, idempotencyKey: string): Promise<Transaction> {
  try {
    const response = await api.post<ApiResponse<ApiTransaction>>(
      '/api/transactions',
      { type: 'expense', ...payload },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    )

    if (!response.data.data) {
      throw new Error(t('transactions.serviceErrors.invalidApiResponse'))
    }

    return mapApiTransactionToTransaction(response.data.data)
  } catch (error) {
    handleDepositWithdrawalError(error)
  }
}

/**
 * Crée un apport de fonds (POST /api/transactions, type=apport). Réutilise
 * l'en-tête Idempotency-Key (voir wallet/new/page.tsx) : généré une seule
 * fois par soumission par l'appelant, conservé pour tous les retries
 * automatiques de CETTE tentative — un double envoi ne crée pas deux apports.
 */
export async function createDeposit(payload: CreateDepositPayload, idempotencyKey: string): Promise<Transaction> {
  try {
    const response = await api.post<ApiResponse<ApiTransaction>>(
      '/api/transactions',
      { type: 'apport', ...payload },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    )

    if (!response.data.data) {
      throw new Error(t('transactions.serviceErrors.invalidApiResponse'))
    }

    return mapApiTransactionToTransaction(response.data.data)
  } catch (error) {
    handleDepositWithdrawalError(error)
  }
}

/**
 * Crée un retrait (POST /api/transactions, type=retrait) — mêmes garanties
 * d'idempotence que createDeposit().
 */
export async function createWithdrawal(payload: CreateWithdrawalPayload, idempotencyKey: string): Promise<Transaction> {
  try {
    const response = await api.post<ApiResponse<ApiTransaction>>(
      '/api/transactions',
      { type: 'retrait', ...payload },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    )

    if (!response.data.data) {
      throw new Error(t('transactions.serviceErrors.invalidApiResponse'))
    }

    return mapApiTransactionToTransaction(response.data.data)
  } catch (error) {
    handleDepositWithdrawalError(error)
  }
}

