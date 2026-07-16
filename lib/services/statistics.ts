import api, { isApiError, ApiErrorType } from '../api'
import type { AxiosError } from 'axios'
import { isSilentError, isAuthError } from '../utils/error-handler'
import type { ApiTransaction } from './transactions'

/**
 * Statistiques utilisateur retournées par GET /api/user
 */
export interface UserStats {
  calculated_wallet: number // Solde actuel
  total_sale: number // Total des ventes
  total_expense: number // Total des dépenses
  personal_income: number // Revenu personnel
  [key: string]: unknown
}

/**
 * Récupère les statistiques utilisateur depuis GET /api/user
 */
export async function getUserStats(): Promise<UserStats> {
  try {
    const response = await api.get<UserStats>('/api/user')
    
    // Normaliser les données
    const data = response.data
    
    return {
      calculated_wallet: data.calculated_wallet ?? 0,
      total_sale: data.total_sale ?? 0,
      total_expense: data.total_expense ?? 0,
      personal_income: data.personal_income ?? data.wallet ?? 0,
    }
  } catch (error) {
    // Erreurs silencieuses (déconnexion, redirection) → re-throw silencieusement
    if (isSilentError(error)) {
      throw error
    }
    
    // Erreurs 401/403 (non authentifié) → throw sans log
    if (isAuthError(error)) {
      throw new Error('Non authentifié')
    }

    // Erreurs serveur (500) → log + throw
    const axiosError = error as AxiosError<{ message?: string }>
    if (axiosError.response?.status && axiosError.response.status >= 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur serveur statistiques:', axiosError.response.status)
      }
      throw new Error('Erreur serveur lors du chargement des statistiques')
    }

    // Autres erreurs → log + throw
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur statistiques:', error)
    }
    throw new Error('Erreur lors du chargement des statistiques')
  }
}

/**
 * Récupère toutes les transactions depuis GET /api/transactions
 */
export async function getTransactionsForStats(): Promise<ApiTransaction[]> {
  try {
    const response = await api.get<{ data?: ApiTransaction[] } | ApiTransaction[]>('/api/transactions')
    
    // Normaliser la réponse
    const transactions = Array.isArray(response.data)
      ? response.data
      : (response.data as { data?: ApiTransaction[] })?.data || []
    
    if (!Array.isArray(transactions)) {
      console.warn('Réponse API transactions non valide:', transactions)
      return []
    }

    return transactions
  } catch (error) {
    // Erreurs silencieuses (déconnexion, redirection) → re-throw silencieusement
    if (isSilentError(error)) {
      throw error
    }
    
    // Erreurs 401/403 (non authentifié) → throw sans log
    if (isAuthError(error)) {
      throw new Error('Non authentifié')
    }

    // Erreurs serveur (500) → log + throw
    const axiosError = error as AxiosError<{ message?: string }>
    if (axiosError.response?.status && axiosError.response.status >= 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur serveur transactions:', axiosError.response.status)
      }
      throw new Error('Erreur serveur lors du chargement des transactions')
    }

    // Autres erreurs → log + throw
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur transactions:', error)
    }
    throw new Error('Erreur lors du chargement des transactions')
  }
}

