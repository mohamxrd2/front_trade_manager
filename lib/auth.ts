import api, { setLoggingOut } from './api'
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
    const axiosError = error as AxiosError<{ message?: string }>

    // Gestion spécifique de l'erreur 401 (identifiants invalides) - cas normal, pas d'erreur console
    if (axiosError.response?.status === 401) {
      // Erreur 401 est normale quand les identifiants sont incorrects
      // Ne pas logger comme erreur, juste re-throw pour que le contexte gère l'affichage
      throw error
    }

    // Gestion spécifique de l'erreur 419 (CSRF token mismatch)
    if (axiosError.response?.status === 419) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 Erreur 419 - CSRF token mismatch')
        console.error('   Le token CSRF n\'a pas été correctement envoyé.')
        console.error('   Vérifiez que:')
        console.error('   1. Le cookie XSRF-TOKEN est présent dans document.cookie')
        console.error('   2. Le header X-XSRF-TOKEN est envoyé avec la requête')
        console.error('   3. La configuration CORS Laravel permet les credentials')
        console.error('   4. SANCTUM_STATEFUL_DOMAINS inclut localhost:3000')
      }
      
      // Créer une erreur avec un message plus clair
      const csrfError = new Error('Erreur de sécurité CSRF. Veuillez rafraîchir la page et réessayer.') as Error & { response?: { status?: number } }
      csrfError.response = { status: 419 }
      throw csrfError
    }

    // Pour les autres erreurs (500, réseau, etc.), logger comme erreur
    if (process.env.NODE_ENV !== 'production') {
      const errorParts: string[] = []
      if (axiosError.response?.status) errorParts.push(`Status: ${axiosError.response.status}`)
      if (axiosError.response?.data) {
        const dataStr = typeof axiosError.response.data === 'object'
          ? JSON.stringify(axiosError.response.data)
          : String(axiosError.response.data)
        errorParts.push(`Data: ${dataStr}`)
      }
      if (axiosError.message) errorParts.push(`Message: ${axiosError.message}`)
      if (errorParts.length > 0) {
        console.error('🚨 Erreur login:', errorParts.join(' | '))
      }
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
 * 
 * Format des erreurs :
 * - 422 (Validation) : { message: string, errors: { field: string[] } }
 * - 500 (Serveur) : { message: string }
 * - Autres : AxiosError
 */
export async function register(data: RegisterData): Promise<User> {
  try {
    // L'intercepteur axios récupère automatiquement le cookie CSRF
    const response = await api.post<User>('/api/register', data)
    return response.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string; errors?: ValidationErrors }>

    // Logging détaillé en développement
    if (process.env.NODE_ENV !== 'production') {
      const errorParts: string[] = []
      if (axiosError.response?.status) errorParts.push(`Status: ${axiosError.response.status}`)
      if (axiosError.response?.data) {
        const dataStr = typeof axiosError.response.data === 'object'
          ? JSON.stringify(axiosError.response.data)
          : String(axiosError.response.data)
        errorParts.push(`Data: ${dataStr}`)
      }
      if (axiosError.message) errorParts.push(`Message: ${axiosError.message}`)
      if (errorParts.length > 0) {
        console.error('🚨 Erreur register:', errorParts.join(' | '))
      }

      // Aide spécifique pour les erreurs de validation
      if (axiosError.response?.status === 422 && axiosError.response?.data?.errors) {
        console.error('📋 Erreurs de validation par champ:', axiosError.response.data.errors)
      }
    }

    // Re-throw l'erreur pour que le contexte puisse la gérer
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
    const axiosError = error as AxiosError<{ message?: string }>

    // Les erreurs 401 pendant la déconnexion sont normales, ne pas les logger
    if (axiosError.response?.status === 401) {
      // Ignorer silencieusement
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      const errorParts: string[] = []
      if (axiosError.response?.status) errorParts.push(`Status: ${axiosError.response.status}`)
      if (axiosError.response?.data) {
        const dataStr = typeof axiosError.response.data === 'object'
          ? JSON.stringify(axiosError.response.data)
          : String(axiosError.response.data)
        errorParts.push(`Data: ${dataStr}`)
      }
      if (axiosError.message) errorParts.push(`Message: ${axiosError.message}`)
      if (errorParts.length > 0) {
        console.error('🚨 Erreur logout:', errorParts.join(' | '))
      }
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
 * @throws Erreur pour les autres types d'erreurs (réseau, serveur, etc.)
 */
export async function getUser(): Promise<User | null> {
  try {
    const response = await api.get<User>('/api/user')
    return response.data
  } catch (error: unknown) {
    const axiosError = error as AxiosError<{ message?: string }>

    // Si c'est une erreur 401 (non authentifié), retourner null (pas d'erreur)
    if (axiosError.response?.status === 401) {
      return null
    }

    // Pour les autres erreurs, logger et throw
    if (process.env.NODE_ENV !== 'production') {
      const errorParts: string[] = []
      if (axiosError.response?.status) errorParts.push(`Status: ${axiosError.response.status}`)
      if (axiosError.response?.data) {
        const dataStr = typeof axiosError.response.data === 'object'
          ? JSON.stringify(axiosError.response.data)
          : String(axiosError.response.data)
        errorParts.push(`Data: ${dataStr}`)
      }
      if (axiosError.message) errorParts.push(`Message: ${axiosError.message}`)
      if (axiosError.code) errorParts.push(`Code: ${axiosError.code}`)
      if (errorParts.length > 0) {
        console.error('🚨 Erreur getUser:', errorParts.join(' | '))
      } else {
        console.error('🚨 Erreur getUser: Erreur inconnue', error)
      }

      // Aide supplémentaire pour les erreurs réseau
      if (axiosError.code === 'ERR_NETWORK' || !axiosError.response) {
        const fullUrl = axiosError.config?.baseURL && axiosError.config?.url
          ? `${axiosError.config.baseURL}${axiosError.config.url}`
          : 'URL non disponible'

        console.error('💡 Problème réseau détecté:', {
          code: axiosError.code || 'INCONNU',
          message: axiosError.message || 'Pas de message',
          url: fullUrl,
          suggestion: 'Vérifiez que le serveur Laravel est démarré et que CORS est configuré',
        })
      }
    }

    // Pour les erreurs autres que 401, throw l'erreur
    throw error
  }
}

