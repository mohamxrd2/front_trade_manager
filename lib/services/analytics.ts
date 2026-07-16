import api from '../api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'

/**
 * Types pour les données Analytics
 */

export type PeriodType = 'today' | '7' | '30' | 'year' | 'all' | 'custom'

export interface AnalyticsParams {
  period?: PeriodType
  start_date?: string
  end_date?: string
  type?: string
  search?: string
  page?: number
  per_page?: number
}

/**
 * Aperçu des performances globales
 */
export interface OverviewData {
  net_revenue: number
  total_sales: number
  total_expenses: number
  period: string
  start_date: string
  end_date: string
}

/**
 * Données de tendances
 */
export interface TrendsData {
  sales_expenses?: {
    sales: Array<{ date: string; amount: number }>
    expenses: Array<{ date: string; amount: number }>
  }
  wallet?: Array<{ date: string; amount: number }>
}

/**
 * Analyse par catégorie
 */
export interface CategoryAnalysisData {
  sales_by_type: Array<{
    type: string
    total: number
    percentage: number
  }>
  top_products: Array<{
    id: string
    name: string
    type: string
    total_quantity: number
    total_amount: number
  }>
}

/**
 * Comparaisons temporelles
 */
export interface ComparisonData {
  current: number
  previous: number
  change: number
  change_type: 'increase' | 'decrease'
}

export interface ComparisonsData {
  sales: ComparisonData
  expenses: ComparisonData
  net_revenue: ComparisonData
}

/**
 * KPI financiers
 */
export interface KPIsData {
  net_margin: number
  average_basket: number
  average_sales_per_day: number
  expense_rate: number
  sales_count: number
  days: number
}

/**
 * Transaction pour le tableau
 */
export interface AnalyticsTransaction {
  id: string
  name: string
  type: 'sale' | 'expense'
  amount: number
  created_at: string
  article?: {
    id: string
    name: string
  } | null
}

export interface TransactionsResponse {
  transactions: AnalyticsTransaction[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

/**
 * Prédictions de réapprovisionnement
 */
export interface PredictionData {
  article_id: string
  article_name: string
  type: string
  current_quantity: number
  sold_quantity: number
  remaining_quantity: number
  sales_percentage: number
  status: 'in_stock' | 'out_of_stock'
  predicted_reorder_date: string | null
  days_until_reorder: number
  sales_rate_per_day: number
  average_interval_days: number
}

/**
 * Réponse API standard
 */
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

/**
 * Fonction utilitaire pour construire les paramètres
 */
function buildParams(params: AnalyticsParams): Record<string, string | number> {
  const queryParams: Record<string, string | number> = {}
  
  if (params.period) queryParams.period = params.period
  if (params.start_date) queryParams.start_date = params.start_date
  if (params.end_date) queryParams.end_date = params.end_date
  if (params.type) queryParams.type = params.type
  if (params.search) queryParams.search = params.search
  if (params.page) queryParams.page = params.page
  if (params.per_page) queryParams.per_page = params.per_page
  
  return queryParams
}

/**
 * Récupère l'aperçu des performances globales
 */
export async function getAnalyticsOverview(params: AnalyticsParams): Promise<OverviewData> {
  try {
    const response = await api.get<ApiResponse<OverviewData>>('/api/analytics/overview', {
      params: buildParams(params),
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('Erreur lors de la récupération de l\'aperçu:', error)
    throw new Error('Erreur lors du chargement de l\'aperçu')
  }
}

/**
 * Récupère les données de tendances
 */
export async function getAnalyticsTrends(params: AnalyticsParams): Promise<TrendsData> {
  try {
    const response = await api.get<ApiResponse<TrendsData>>('/api/analytics/trends', {
      params: { ...buildParams(params), type: params.type || 'both' },
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('Erreur lors de la récupération des tendances:', error)
    throw new Error('Erreur lors du chargement des tendances')
  }
}

/**
 * Récupère l'analyse par catégorie
 */
export async function getCategoryAnalysis(params: AnalyticsParams): Promise<CategoryAnalysisData> {
  try {
    const response = await api.get<ApiResponse<CategoryAnalysisData>>('/api/analytics/category-analysis', {
      params: buildParams(params),
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('Erreur lors de la récupération de l\'analyse par catégorie:', error)
    throw new Error('Erreur lors du chargement de l\'analyse par catégorie')
  }
}

/**
 * Récupère les comparaisons temporelles
 */
export async function getComparisons(params: AnalyticsParams): Promise<ComparisonsData> {
  try {
    const queryParams = buildParams(params)
    console.log('🔍 Chargement des comparaisons avec params:', queryParams)
    
    const response = await api.get<ApiResponse<ComparisonsData>>('/api/analytics/comparisons', {
      params: queryParams,
    })
    
    console.log('✅ Données de comparaisons reçues (brutes):', response.data)
    console.log('✅ Structure data:', response.data.data)
    
    // Vérifier que les données sont valides
    if (!response.data.data) {
      console.warn('⚠️ Aucune donnée de comparaison reçue')
      throw new Error('Aucune donnée de comparaison disponible')
    }
    
    const comparisonsData = response.data.data
    
    // Normaliser les données avec des valeurs par défaut
    const normalizedData: ComparisonsData = {
      sales: {
        current: comparisonsData.sales?.current ?? 0,
        previous: comparisonsData.sales?.previous ?? 0,
        change: comparisonsData.sales?.change ?? 0,
        change_type: (comparisonsData.sales?.change_type ?? 'neutral') as 'increase' | 'decrease',
      },
      expenses: {
        current: comparisonsData.expenses?.current ?? 0,
        previous: comparisonsData.expenses?.previous ?? 0,
        change: comparisonsData.expenses?.change ?? 0,
        change_type: (comparisonsData.expenses?.change_type ?? 'neutral') as 'increase' | 'decrease',
      },
      net_revenue: {
        current: comparisonsData.net_revenue?.current ?? 0,
        previous: comparisonsData.net_revenue?.previous ?? 0,
        change: comparisonsData.net_revenue?.change ?? 0,
        change_type: (comparisonsData.net_revenue?.change_type ?? 'neutral') as 'increase' | 'decrease',
      },
    }
    
    console.log('✅ Données de comparaisons normalisées:', normalizedData)
    
    return normalizedData
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('❌ Erreur lors de la récupération des comparaisons:', {
      error,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      params: buildParams(params),
    })
    throw new Error('Erreur lors du chargement des comparaisons')
  }
}

/**
 * Récupère les KPI financiers
 */
export async function getKPIs(params: AnalyticsParams): Promise<KPIsData> {
  try {
    const response = await api.get<ApiResponse<KPIsData>>('/api/analytics/kpis', {
      params: buildParams(params),
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('Erreur lors de la récupération des KPI:', error)
    throw new Error('Erreur lors du chargement des KPI')
  }
}

/**
 * Récupère les transactions détaillées
 */
export async function getAnalyticsTransactions(params: AnalyticsParams): Promise<TransactionsResponse> {
  try {
    const response = await api.get<ApiResponse<TransactionsResponse>>('/api/analytics/transactions', {
      params: buildParams(params),
    })
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('Erreur lors de la récupération des transactions:', error)
    throw new Error('Erreur lors du chargement des transactions')
  }
}

/**
 * Récupère les prédictions de réapprovisionnement
 */
export async function getPredictions(): Promise<PredictionData[]> {
  try {
    const response = await api.get<ApiResponse<PredictionData[]>>('/api/analytics/predictions')
    return response.data.data
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    // Vérifier si c'est une erreur silencieuse de déconnexion
    if (isSilentError(error)) {
      throw error
    }
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }
    console.error('Erreur lors de la récupération des prédictions:', error)
    throw new Error('Erreur lors du chargement des prédictions')
  }
}

