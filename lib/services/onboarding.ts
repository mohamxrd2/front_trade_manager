import api from '@/lib/api'
import { isSilentError } from '@/lib/utils/error-handler'

export interface OnboardingStatus {
  is_complete: boolean
}

export interface OnboardingData {
  company_name: string
  company_sector?: string | null
  company_headquarters?: string | null
  company_email?: string | null
  company_legal_status?: string | null
  company_bank_account_number?: string | null
  company_logo?: string | null
  currency: 'FCFA' | 'EUR' | 'USD' | 'XOF' | 'GBP' | 'JPY' | 'CNY' | 'INR' | 'BRL' | 'CAD' | 'AUD' | 'CHF' | 'NGN' | 'ZAR' | 'EGP'
}

export interface OnboardingResponse {
  success: boolean
  message?: string
  data?: OnboardingStatus
}

/**
 * Vérifie l'état d'onboarding de l'utilisateur
 */
export async function checkOnboarding(): Promise<OnboardingStatus> {
  try {
    const response = await api.get<OnboardingResponse>('/api/onboarding/check')
    
    if (response.data.success && response.data.data) {
      return response.data.data
    }
    
    // Par défaut, considérer que l'onboarding n'est pas complété
    return { is_complete: false }
  } catch (error: unknown) {
    // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
    if (isSilentError(error)) {
      throw error
    }

    const axiosError = error as { response?: { status?: number } }
    
    // Si erreur 404, l'onboarding n'existe pas encore
    if (axiosError?.response?.status === 404) {
      return { is_complete: false }
    }

    // Pour les autres erreurs, re-lancer
    throw error
  }
}

/**
 * Complète l'onboarding avec les données fournies
 */
export async function completeOnboarding(data: OnboardingData): Promise<void> {
  try {
    const response = await api.post<OnboardingResponse>('/api/onboarding/complete', data)
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Erreur lors de la complétion de l\'onboarding')
    }
  } catch (error: unknown) {
    // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
    if (isSilentError(error)) {
      throw error
    }

    const axiosError = error as { 
      response?: { 
        status?: number
        data?: { 
          message?: string
          errors?: Record<string, string[]>
        }
      }
    }

    // Erreur 401 : Non authentifié (sera gérée par l'intercepteur Axios)
    if (axiosError?.response?.status === 401) {
      // L'intercepteur Axios devrait déjà avoir géré la redirection
      // Si l'erreur arrive ici, c'est qu'elle n'a pas été marquée comme silencieuse
      // On la re-lance telle quelle pour que l'intercepteur puisse la traiter
      throw error
    }

    // Erreur 422 : Validation
    if (axiosError?.response?.status === 422) {
      const errors = axiosError.response.data?.errors
      if (errors) {
        const errorMessages = Object.values(errors).flat()
        throw new Error(errorMessages.join(', '))
      }
      throw new Error(axiosError.response.data?.message || 'Erreur de validation')
    }

    // Erreur 500 : Serveur
    if (axiosError?.response?.status === 500) {
      throw new Error(axiosError.response.data?.message || 'Erreur serveur')
    }

    // Autres erreurs
    throw error
  }
}

