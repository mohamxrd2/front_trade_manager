import api, { setLoggingOut, isApiError, ApiErrorType, type ApiError } from './api'
import type { AxiosError } from 'axios'

/**
 * Types pour les données utilisateur
 */
export interface User {
  id: string
  first_name: string
  last_name: string
  username: string
  email: string
  company_share?: string
  profile_image?: string | null
  provider?: string
  provider_id?: string | null
  email_verified_at?: string | null
  created_at?: string
  updated_at?: string
  total_articles?: number
  total_low_stock?: number
  total_stock_value?: number
  total_remaining_quantity?: number
  total_sale?: number
  total_expense?: number
  calculated_wallet?: number
  wallet?: number
}

/**
 * Types pour les credentials de connexion
 * Le champ 'login' peut être soit un email soit un username
 */
export interface LoginCredentials {
  login: string
  password: string
  remember?: boolean
}

/**
 * Types pour les données d'inscription
 */
export interface RegisterData {
  first_name: string
  last_name: string
  username: string
  email: string
  password: string
  password_confirmation: string
  company_share?: number // 0-100, défaut 100
  profile_image?: string | null
}

/**
 * Types pour les erreurs de validation Laravel
 */
export interface ValidationErrors {
  [field: string]: string[]
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Vérifie si une erreur est une erreur 401 (non authentifié)
 * Gère les deux formats : ApiError et AxiosError
 */
function isUnauthorizedError(error: unknown): boolean {
  // Format ApiError (nouveau système)
  if (isApiError(error)) {
    return error.type === ApiErrorType.UNAUTHORIZED || error.status === 401
  }

  // Format AxiosError (ancien système)
  const axiosError = error as AxiosError
  return axiosError?.response?.status === 401
}

/**
 * Vérifie si une erreur est une erreur silencieuse (ne pas logger)
 */
function isSilentError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.silent === true
  }
  
  const legacyError = error as Error & { silent?: boolean }
  return legacyError?.silent === true
}

/**
 * Vérifie si une erreur est une erreur réseau
 */
function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT
  }

  const axiosError = error as AxiosError
  return axiosError?.code === 'ERR_NETWORK' || !axiosError?.response
}

/**
 * Récupère le code de statut HTTP d'une erreur
 */
function getErrorStatus(error: unknown): number | undefined {
  if (isApiError(error)) {
    return error.status
  }

  const axiosError = error as AxiosError
  return axiosError?.response?.status
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Récupère le cookie CSRF depuis Laravel Sanctum
 * Cette fonction est appelée automatiquement par l'intercepteur axios,
 * mais peut être appelée manuellement si nécessaire
 */
export async function getCsrfCookie(): Promise<void> {
  try {
    await api.get('/sanctum/csrf-cookie')
  } catch (error) {
    // Si le endpoint CSRF n'existe pas, continuer quand même
    if (process.env.NODE_ENV !== 'production') {
      console.debug('⚠️ CSRF cookie non disponible')
    }
  }
}

/**
 * Connexion d'un utilisateur
 * 
 * @param credentials - { login: string (email ou username), password: string, remember?: boolean }
 * @returns L'utilisateur connecté
 * @throws Erreur si la connexion échoue
 */
export async function login(credentials: LoginCredentials): Promise<User> {
  try {
    // L'intercepteur axios récupère automatiquement le cookie CSRF
    const response = await api.post<User>('/api/login', credentials)
    return response.data
  } catch (error: unknown) {
    // Erreur 401 est normale quand les identifiants sont incorrects
    // Ne pas logger comme erreur, juste re-throw pour que le contexte gère l'affichage
    if (isUnauthorizedError(error)) {
      throw error
    }

    // Gestion spécifique de l'erreur 419 (CSRF token mismatch)
    const status = getErrorStatus(error)
    if (status === 419) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 419 - CSRF token mismatch')
        console.error('   Le token CSRF n\'a pas été correctement envoyé.')
      }
      
      const csrfError = new Error('Erreur de sécurité CSRF. Veuillez rafraîchir la page et réessayer.') as ApiError
      csrfError.type = ApiErrorType.CSRF
      csrfError.status = 419
      throw csrfError
    }

    // Pour les autres erreurs (500, réseau, etc.), logger comme erreur
    if (process.env.NODE_ENV !== 'production' && !isSilentError(error)) {
      console.error('🚨 Erreur login:', error)
    }

    throw error
  }
}

/**
 * Inscription d'un utilisateur
 * 
 * @param data - Données d'inscription
 * @returns L'utilisateur créé
 * @throws Erreur si l'inscription échoue
 */
export async function register(data: RegisterData): Promise<User> {
  try {
    // L'intercepteur axios récupère automatiquement le cookie CSRF
    const response = await api.post<User>('/api/register', data)
    return response.data
  } catch (error: unknown) {
    // Logging détaillé en développement (sauf pour les erreurs silencieuses)
    if (process.env.NODE_ENV !== 'production' && !isSilentError(error)) {
      const status = getErrorStatus(error)
      
      // Aide spécifique pour les erreurs de validation
      if (status === 422) {
        const axiosError = error as AxiosError<{ errors?: ValidationErrors }>
        if (axiosError?.response?.data?.errors) {
          console.error('📋 Erreurs de validation par champ:', axiosError.response.data.errors)
        }
      } else {
        console.error('🚨 Erreur register:', error)
      }
    }

    throw error
  }
}

/**
 * Déconnexion de l'utilisateur
 * 
 * @throws Erreur si la déconnexion échoue (mais on continue quand même)
 */
export async function logout(): Promise<void> {
  try {
    // Marquer qu'on est en train de se déconnecter pour éviter les erreurs 401
    setLoggingOut(true)
    
    // L'intercepteur axios récupère automatiquement le cookie CSRF
    await api.post('/api/logout')
  } catch (error: unknown) {
    // Les erreurs 401 pendant la déconnexion sont normales, ne pas les logger
    if (isUnauthorizedError(error) || isSilentError(error)) {
      return
    }

    // Logger uniquement les vraies erreurs (500, réseau)
    if (process.env.NODE_ENV !== 'production') {
      console.error('🚨 Erreur logout:', error)
    }

    // Même en cas d'erreur, on considère la déconnexion comme réussie
  } finally {
    // Réinitialiser le flag après un court délai pour permettre à toutes les requêtes en cours de se terminer
    setTimeout(() => {
      setLoggingOut(false)
    }, 1000)
  }
}

/**
 * Récupère l'utilisateur connecté
 * 
 * @returns L'utilisateur connecté, ou null si non authentifié (401)
 * 
 * IMPORTANT: Cette fonction ne throw PAS d'erreur pour les 401.
 * Un 401 signifie simplement "non authentifié" = retourne null.
 * 
 * @throws Erreur uniquement pour les vraies erreurs (réseau, serveur 500, etc.)
 */
export async function getUser(): Promise<User | null> {
  try {
    const response = await api.get<User>('/api/user')
    return response.data
  } catch (error: unknown) {
    // ================================================================
    // CAS 1: Erreur 401 (non authentifié)
    // C'est un état NORMAL, pas une erreur à logger
    // ================================================================
    if (isUnauthorizedError(error)) {
      // Retourner null silencieusement - l'utilisateur n'est simplement pas connecté
      return null
    }

    // ================================================================
    // CAS 2: Erreur silencieuse (redirection en cours, déconnexion, etc.)
    // Ne pas logger, retourner null
    // ================================================================
    if (isSilentError(error)) {
      return null
    }

    // ================================================================
    // CAS 3: Vraie erreur (réseau, serveur 500, etc.)
    // Logger et throw
    // ================================================================
    if (process.env.NODE_ENV !== 'production') {
      if (isNetworkError(error)) {
        console.warn('⚠️ getUser: Erreur réseau - Le serveur est peut-être inaccessible')
      } else {
        const status = getErrorStatus(error)
        if (status && status >= 500) {
          console.error('🚨 getUser: Erreur serveur', status)
        } else {
          console.error('🚨 getUser: Erreur inattendue', error)
        }
      }
    }

    // Pour les erreurs réseau, ne pas throw (on ne sait pas si on est connecté ou non)
    // Retourner null pour éviter de bloquer l'UI
    if (isNetworkError(error)) {
      return null
    }

    // Pour les vraies erreurs serveur, throw
    throw error
  }
}
