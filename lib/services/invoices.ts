import api, { API_BASE_URL, type NoRetryRequestConfig } from '../api'
import type { AxiosError } from 'axios'
import { isSilentError, isAuthError } from '../utils/error-handler'

// ============================================================================
// TYPES - CLIENT
// ============================================================================

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other' | null
  billing_address: string | null
  shipping_address: string | null
  created_at: string
  updated_at: string
}

export interface CreateClientPayload {
  name: string
  email?: string | null
  phone?: string | null
  payment_method?: 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other' | null
  billing_address?: string | null
  shipping_address?: string | null
}

export interface UpdateClientPayload extends CreateClientPayload {
  id: string
}

// ============================================================================
// TYPES - INVOICE
// ============================================================================

export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'cancelled' | 'overdue'
export type InvoiceTheme = 'classic' | 'modern' | 'minimal' | 'professional'
export type DiscountType = 'percentage' | 'fixed'

export interface InvoiceItemArticle {
  id: string
  name: string
  image: string | null
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  article_id: string
  name_snapshot: string
  quantity: number
  unit_price: string // API returns string
  discount_percent: string
  discount_amount: string
  total_line: string
  article: InvoiceItemArticle | null
}

export interface InvoiceCompany {
  id: string
  name: string
  email: string
  logo_url: string | null
}

export interface Invoice {
  id: string
  user_id: string
  company_id: string
  client_id: string
  invoice_number: string
  status: InvoiceStatus
  theme: InvoiceTheme
  subtotal: string // API returns string
  discount_percent: string
  discount_amount: string
  tax_percent: string
  tax_amount: string
  shipping_fee: string
  total: string
  billing_address: string | null
  shipping_address: string | null
  notes: string | null
  terms: string | null
  issued_at: string
  due_date: string
  paid_at: string | null
  is_overdue: boolean
  days_until_due: number | null
  formatted_total: string
  client: Client
  company: InvoiceCompany
  items: InvoiceItem[]
}

export interface CreateInvoicePayload {
  client_id: string
  items: Array<{
    article_id: string
    quantity: number
    unit_price?: number
    discount_percent?: number
  }>
  discount_percent?: number
  tax_percent?: number
  shipping_fee?: number
  billing_address?: string
  shipping_address?: string
  notes?: string
  terms?: string
  due_date: string
  theme: InvoiceTheme
  status?: 'draft' | 'unpaid'
}

// ============================================================================
// TYPES - DASHBOARD
// ============================================================================

export interface InvoiceDashboardStats {
  unpaid_count: number
  unpaid_amount: number
  total_invoices: number
  total_collected: number
  recent_invoices: Invoice[]
}

// ============================================================================
// TYPES - COMPANY
// ============================================================================

export interface CompanyInfo {
  id: string
  name: string | null
  email: string | null
  logo: string | null
  phone: string | null
  address: string | null
  tax_id: string | null
}

export interface UpdateCompanyPayload {
  email?: string
  logo?: string | null
  name?: string
  phone?: string
  address?: string
  tax_id?: string
}

// ============================================================================
// HELPER - ERROR HANDLING
// ============================================================================

function handleApiError(error: unknown, context: string): never {
  if (isSilentError(error)) {
    throw error
  }

  if (isAuthError(error)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Non authentifié')
  }

  const axiosError = error as AxiosError<{ message?: string; code?: string }>
  const status = axiosError.response?.status
  const message = axiosError.response?.data?.message
  const code = axiosError.response?.data?.code

  // Entreprise incomplète
  if (code === 'COMPANY_INCOMPLETE') {
    if (typeof window !== 'undefined') {
      window.location.href = '/company/complete-invoice-profile'
    }
    throw new Error('Profil entreprise incomplet')
  }

  if (status === 422) {
    const validationError = new Error(message || 'Erreur de validation') as Error & {
      status: number
      errors: Record<string, string[]>
    }
    validationError.status = 422
    validationError.errors = (axiosError.response?.data as { errors?: Record<string, string[]> })?.errors || {}
    throw validationError
  }

  if (status === 404) {
    throw new Error(message || 'Ressource non trouvée')
  }

  if (status && status >= 500) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`🚨 Erreur serveur ${context}:`, message)
    }
    throw new Error('Erreur serveur')
  }

  throw new Error(message || `Erreur ${context}`)
}

// ============================================================================
// API - COMPANY
// ============================================================================

/**
 * Vérifie si le profil entreprise est complet pour la facturation
 */
export async function checkCompanyProfile(): Promise<{ isComplete: boolean; company: CompanyInfo | null }> {
  try {
    const response = await api.get('/api/user')
    const data = response.data

    // Debug log
    if (process.env.NODE_ENV !== 'production') {
      console.debug('checkCompanyProfile response:', data)
    }

    // Handle different response formats
    let company: CompanyInfo | null = null

    if (data && typeof data === 'object') {
      // Format: { company: {...} }
      if (data.company) {
        company = data.company
      }
      // Format: { data: { company: {...} } }
      else if (data.data?.company) {
        company = data.data.company
      }
      // Format: user object with company field
      else if (data.user?.company) {
        company = data.user.company
      }
    }

    // Vérifier si email et logo sont présents
    const isComplete = Boolean(company?.email && company?.logo)

    return { isComplete, company }
  } catch (error) {
    // En cas d'erreur, on considère le profil comme complet pour ne pas bloquer
    // Le backend vérifiera de toute façon lors de la création de facture
    if (process.env.NODE_ENV !== 'production') {
      console.error('checkCompanyProfile error:', error)
    }
    return { isComplete: true, company: null }
  }
}

/**
 * Met à jour le profil entreprise
 */
export async function updateCompanyProfile(data: UpdateCompanyPayload): Promise<CompanyInfo> {
  try {
    const response = await api.post<{ success: boolean; data: CompanyInfo }>('/api/company/update', data)
    return response.data.data
  } catch (error) {
    handleApiError(error, 'updateCompanyProfile')
  }
}

// ============================================================================
// API - CLIENTS
// ============================================================================

/**
 * Récupère la liste des clients
 */
export async function getClients(): Promise<Client[]> {
  try {
    const response = await api.get('/api/clients')
    const data = response.data

    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 API /api/clients response:', data)
    }

    // Format API: { success: true, data: { clients: [...], pagination: {...} } }
    if (data?.success && data?.data?.clients) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('✅ Clients loaded:', data.data.clients.length)
      }
      return data.data.clients
    }

    // Fallback formats
    if (Array.isArray(data)) {
      return data
    }

    if (Array.isArray(data?.data)) {
      return data.data
    }

    if (Array.isArray(data?.clients)) {
      return data.clients
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ getClients: unexpected format', data)
    }
    return []
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ getClients error:', error)
    }
    return []
  }
}

/**
 * Récupère un client par ID
 */
export async function getClientById(id: string): Promise<Client> {
  try {
    const response = await api.get<{ success: boolean; data: Client } | Client>(`/api/clients/${id}`)

    if ('data' in response.data && response.data.data) {
      return response.data.data
    }

    return response.data as Client
  } catch (error) {
    handleApiError(error, 'getClientById')
  }
}

/**
 * Crée un nouveau client
 */
export async function createClient(data: CreateClientPayload): Promise<Client> {
  try {
    const response = await api.post('/api/clients', data)
    const responseData = response.data

    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 createClient response:', responseData)
    }

    // Format API: { success: true, data: { client: {...} } } ou { success: true, data: {...} }
    if (responseData?.success && responseData?.data) {
      // Format: { data: { client: {...} } }
      if (responseData.data.client) {
        return responseData.data.client
      }
      // Format: { data: {...} } (client direct)
      if (responseData.data.id) {
        return responseData.data
      }
    }

    // Fallbacks
    if (responseData?.data?.id) {
      return responseData.data
    }
    if (responseData?.client?.id) {
      return responseData.client
    }
    if (responseData?.id) {
      return responseData
    }

    throw new Error('Format de réponse invalide')
  } catch (error) {
    handleApiError(error, 'createClient')
  }
}

/**
 * Met à jour un client
 */
export async function updateClient(id: string, data: CreateClientPayload): Promise<Client> {
  try {
    const response = await api.put(`/api/clients/${id}`, data)
    const responseData = response.data

    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 updateClient response:', responseData)
    }

    // Format API: { success: true, data: { client: {...} } } ou { success: true, data: {...} }
    if (responseData?.success && responseData?.data) {
      if (responseData.data.client) {
        return responseData.data.client
      }
      if (responseData.data.id) {
        return responseData.data
      }
    }

    // Fallbacks
    if (responseData?.data?.id) {
      return responseData.data
    }
    if (responseData?.client?.id) {
      return responseData.client
    }
    if (responseData?.id) {
      return responseData
    }

    throw new Error('Format de réponse invalide')
  } catch (error) {
    handleApiError(error, 'updateClient')
  }
}

/**
 * Supprime un client
 */
export async function deleteClient(id: string): Promise<void> {
  try {
    await api.delete(`/api/clients/${id}`)
  } catch (error) {
    handleApiError(error, 'deleteClient')
  }
}

// ============================================================================
// API - INVOICES
// ============================================================================

/**
 * Récupère les statistiques du dashboard facturation
 */
export async function getInvoiceDashboard(): Promise<InvoiceDashboardStats> {
  try {
    const response = await api.get('/api/invoices/dashboard')
    const data = response.data

    // Debug log
    if (process.env.NODE_ENV !== 'production') {
      console.debug('getInvoiceDashboard response:', data)
    }

    // Le payload utile est dans `data.data`, mais on reste tolérant si
    // jamais l'API renvoie un jour l'objet stats directement à la racine.
    const raw = data?.data && typeof data.data === 'object' ? data.data : data

    if (raw && typeof raw === 'object') {
      // Le backend (InvoiceController::dashboard) renvoie des noms de champs
      // différents de ceux attendus ici (unpaid_invoices_count au lieu de
      // unpaid_count, unpaid_amount_total au lieu de unpaid_amount,
      // paid_amount_total au lieu de total_collected, last_invoices au lieu
      // de recent_invoices) : sans cette normalisation, les 3 cartes
      // affichaient toujours 0 quel que soit le contenu réel des factures.
      return {
        unpaid_count: raw.unpaid_invoices_count ?? raw.unpaid_count ?? 0,
        unpaid_amount: raw.unpaid_amount_total ?? raw.unpaid_amount ?? 0,
        total_invoices: raw.total_invoices ?? 0,
        total_collected: raw.paid_amount_total ?? raw.total_collected ?? 0,
        recent_invoices: raw.last_invoices ?? raw.recent_invoices ?? [],
      }
    }

    // Default empty stats
    return {
      unpaid_count: 0,
      unpaid_amount: 0,
      total_invoices: 0,
      total_collected: 0,
      recent_invoices: [],
    }
  } catch (error) {
    // Return empty stats on error instead of throwing
    if (process.env.NODE_ENV !== 'production') {
      console.error('getInvoiceDashboard error:', error)
    }
    return {
      unpaid_count: 0,
      unpaid_amount: 0,
      total_invoices: 0,
      total_collected: 0,
      recent_invoices: [],
    }
  }
}

/**
 * Récupère la liste des factures
 */
export async function getInvoices(params?: {
  status?: InvoiceStatus
  client_id?: string
  start_date?: string
  end_date?: string
  search?: string
  page?: number
  per_page?: number
}): Promise<{ invoices: Invoice[]; total: number; pages: number }> {
  try {
    const response = await api.get('/api/invoices', { params })
    const data = response.data

    // Debug log
    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 getInvoices raw response:', data)
    }

    // Handle different response formats
    let invoices: Invoice[] = []
    let total = 0
    let pages = 1

    // Format 1: Direct array
    if (Array.isArray(data)) {
      invoices = data
      total = data.length
    } else if (data && typeof data === 'object') {
      // Format 2: { success: true, data: { invoices: [...], pagination: {...} } }
      if (data.data && typeof data.data === 'object') {
        if (Array.isArray(data.data.invoices)) {
          invoices = data.data.invoices
          total = data.data.pagination?.total || data.data.invoices.length
          pages = data.data.pagination?.last_page || 1
          if (process.env.NODE_ENV !== 'production') {
            console.debug('✅ getInvoices parsed (data.data.invoices):', invoices.length, 'items')
          }
        }
        // Format 3: { success: true, data: [...] } - data is direct array
        else if (Array.isArray(data.data)) {
          invoices = data.data
          total = data.meta?.total || data.data.length
          pages = data.meta?.last_page || 1
          if (process.env.NODE_ENV !== 'production') {
            console.debug('✅ getInvoices parsed (data.data array):', invoices.length, 'items')
          }
        }
      }
      // Format 4: { invoices: [...] }
      else if (Array.isArray(data.invoices)) {
        invoices = data.invoices
        total = data.total || data.invoices.length
        pages = data.pages || 1
        if (process.env.NODE_ENV !== 'production') {
          console.debug('✅ getInvoices parsed (data.invoices):', invoices.length, 'items')
        }
      }
    }

    if (invoices.length === 0 && process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ getInvoices: no invoices found in response, raw data:', data)
    }

    return { invoices, total, pages }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ getInvoices error:', error)
    }
    return { invoices: [], total: 0, pages: 1 }
  }
}

/**
 * Récupère une facture par ID
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  // Ne pas fetch si pas d'ID
  if (!id) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ getInvoiceById: no id provided')
    }
    return null
  }

  try {
    const response = await api.get(`/api/invoices/${id}`)
    const data = response.data

    // Debug log
    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 getInvoiceById raw response:', data)
    }

    // Format attendu: { success: true, data: {...} }
    if (data?.success && data?.data) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('✅ getInvoiceById parsed:', data.data.invoice_number)
      }
      return data.data as Invoice
    }

    // Format alternatif: data directement
    if (data?.id && data?.invoice_number) {
      return data as Invoice
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ getInvoiceById: invoice not found in response', data)
    }
    return null
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ getInvoiceById error:', error)
    }
    throw error
  }
}

/**
 * Crée une nouvelle facture
 */
export async function createInvoice(data: CreateInvoicePayload): Promise<Invoice> {
  try {
    // skipRetry: true — POST /api/invoices n'est pas idempotent. Un retry
    // automatique sur 419 CSRF/5xx/réseau (comportement par défaut de
    // l'instance axios) rejouerait la même requête et créerait une seconde
    // facture si la première a en fait été créée côté serveur avant l'échec
    // apparent (timeout, coupure juste après la réponse, etc.).
    const config: NoRetryRequestConfig = { skipRetry: true }
    const response = await api.post<{ success: boolean; data: Invoice }>('/api/invoices', data, config)
    return response.data.data
  } catch (error) {
    handleApiError(error, 'createInvoice')
  }
}

/**
 * Met à jour le statut d'une facture
 */
export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
  try {
    const response = await api.patch(`/api/invoices/${id}/status`, { status })
    const data = response.data

    // Debug log
    if (process.env.NODE_ENV !== 'production') {
      console.debug('📦 updateInvoiceStatus response:', data)
    }

    // Handle different response formats
    if (data?.data?.invoice) return data.data.invoice
    if (data?.data?.id) return data.data
    if (data?.invoice) return data.invoice
    if (data?.id) return data

    throw new Error('Invalid response format')
  } catch (error) {
    // Pas de console.error ici : le caller (handleStatusChange) affiche déjà
    // un toast avec le détail de l'erreur — logguer en plus déclenche
    // l'overlay "Console Error" de Next.js en dev pour une erreur déjà gérée.
    throw error
  }
}

/**
 * Supprime une facture
 * Note: Les factures payées ne peuvent pas être supprimées (raisons comptables)
 */
export async function deleteInvoice(invoiceId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.delete(`/api/invoices/${invoiceId}`)
    return {
      success: response.data?.success ?? true,
      message: response.data?.message ?? 'Facture supprimée avec succès'
    }
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string; code?: string }>
    const status = axiosError.response?.status
    const data = axiosError.response?.data

    // ❌ 403 - Facture payée, ne peut pas être supprimée
    if (status === 403 && data?.code === 'INVOICE_PAID') {
      return {
        success: false,
        message: 'Les factures payées ne peuvent pas être supprimées. Vous pouvez l\'annuler à la place.'
      }
    }

    // ❌ 403 - Autre raison
    if (status === 403) {
      return {
        success: false,
        message: data?.message || 'Vous n\'êtes pas autorisé à supprimer cette facture'
      }
    }

    // ❌ 404 - Facture non trouvée
    if (status === 404) {
      return {
        success: false,
        message: 'Facture non trouvée'
      }
    }

    // ❌ Autre erreur
    return {
      success: false,
      message: data?.message || 'Erreur lors de la suppression'
    }
  }
}

// ============================================================================
// API - PDF (aperçu / téléchargement, générés côté backend)
// ============================================================================

export type InvoicePdfMode = 'preview' | 'download'

/**
 * Récupère le PDF d'une facture (Blob), généré par le backend :
 * - preview  → GET /api/invoices/{id}/preview  (Content-Disposition: inline)
 * - download → GET /api/invoices/{id}/download (Content-Disposition: attachment)
 *
 * Utilise fetch (pas l'instance axios) car on a besoin d'accéder au Blob et
 * au Content-Type bruts de la réponse. Ces routes ne sont PAS publiques —
 * elles nécessitent le cookie de session Sanctum — donc pas question de les
 * mettre directement dans un <a href>/<iframe src> : credentials: 'include'
 * est indispensable pour que le navigateur envoie le cookie.
 *
 * Si le backend échoue (facture introuvable/pas la vôtre → 404, erreur
 * serveur → 500), il répond en JSON au lieu du PDF : on vérifie le
 * Content-Type avant de traiter la réponse comme un PDF, et on extrait le
 * message d'erreur JSON le cas échéant plutôt que de tenter d'afficher du
 * JSON dans un viewer PDF.
 */
export async function getInvoicePdfBlob(id: string, mode: InvoicePdfMode): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/invoices/${id}/${mode}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/pdf' },
  })

  const contentType = response.headers.get('content-type') || ''

  if (!response.ok || !contentType.includes('application/pdf')) {
    let message = mode === 'preview'
      ? 'Erreur lors de la génération de l\'aperçu'
      : 'Erreur lors de la génération du PDF'

    if (contentType.includes('application/json')) {
      try {
        const body = await response.json()
        message = body?.message || message
      } catch {
        // Corps illisible : on garde le message par défaut
      }
    }

    throw new Error(message)
  }

  return response.blob()
}

