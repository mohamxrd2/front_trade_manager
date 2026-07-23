import api from '../api'
import type { AxiosError } from 'axios'
import { isSilentError } from '../utils/error-handler'

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
  name: string
  quantity?: number | null
  amount: number
  sale_price?: number | null
  type: 'sale' | 'expense'
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
  type: 'sale' | 'expense'
  name: string
  quantity?: number | null
  unit_price?: number | null
  sale_price?: number | null
  amount?: number
  date: string // Format: YYYY-MM-DD
}

/**
 * Statistiques wallet retournées par GET /api/user
 */
export interface WalletStats {
  calculated_wallet: number // Solde actuel
  total_sale: number // Total des ventes
  total_expense: number // Total des dépenses
  wallet: number // Revenu personnel
  [key: string]: unknown
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
  
  const salePrice = apiTransaction.sale_price ?? null
  
  return {
    id: apiTransaction.id,
    type: apiTransaction.type,
    name: apiTransaction.name,
    quantity: apiTransaction.quantity ?? null,
    unit_price: salePrice, // Alias pour compatibilité
    sale_price: salePrice, // Prix unitaire pour les ventes
    amount: apiTransaction.amount,
    date: dateString, // Format ISO pour dayjs
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
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la récupération des statistiques:', axiosError.response.data)
      }
      throw new Error('Erreur serveur lors du chargement des statistiques')
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la récupération des statistiques:', error)
    }
    throw new Error('Erreur lors du chargement des statistiques')
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
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la récupération des transactions:', axiosError.response.data)
      }
      throw new Error('Erreur serveur lors du chargement des transactions')
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la récupération des transactions:', error)
    }
    throw new Error('Erreur lors du chargement des transactions')
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
      throw new Error('Réponse API invalide')
    }

    return mapApiTransactionToTransaction(response.data.data)
  } catch (error) {
    const axiosError = error as AxiosError<ApiResponse<unknown> | { message?: string }>
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 400) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur 400 - Bad Request:', axiosError.response.data)
      }
      const message = (axiosError.response.data as { message?: string })?.message || 'Erreur lors de la modification'
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
          _general: ['Erreur de validation. Veuillez vérifier les données saisies.']
        }
      }
    }

    if (axiosError.response?.status === 404) {
      throw new Error('Transaction non trouvée')
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la modification:', axiosError.response.data)
      }
      throw new Error('Erreur serveur lors de la modification')
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la modification de la transaction:', error)
    }
    throw new Error('Erreur lors de la modification de la transaction')
  }
}

/**
 * Supprime une transaction (DELETE /api/transactions/{id})
 */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    await api.delete<ApiResponse<unknown>>(`/api/transactions/${id}`)
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    
    if (axiosError.response?.status === 401) {
      throw new Error('Non authentifié')
    }

    if (axiosError.response?.status === 404) {
      throw new Error('Transaction non trouvée')
    }

    if (axiosError.response?.status === 500) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur serveur lors de la suppression:', axiosError.response.data)
      }
      throw new Error('Erreur serveur lors de la suppression')
    }

    if (process.env.NODE_ENV !== 'production') {
      console.error('Erreur lors de la suppression de la transaction:', error)
    }
    throw new Error('Erreur lors de la suppression de la transaction')
  }
}

