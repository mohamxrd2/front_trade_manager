import api from '@/lib/axios'
import type { User } from '@/context/AuthContext'
import { AxiosError } from 'axios'

/**
 * Service d'authentification pour l'API Laravel Sanctum
 */

// Types pour les credentials de connexion
interface LoginCredentials {
  login: string
  password: string
  remember?: boolean
}

// Type pour la réponse de login
interface LoginResponse {
  success: boolean
  user?: User
  token?: string
  error?: string
}

// Type pour la réponse de l'API Laravel
interface LaravelLoginResponse {
  success: boolean
  message?: string
  data?: {
    user: User
    token: string
    token_type: string
    remember: boolean
  }
  errors?: Record<string, string[]>
}

// Types pour les credentials d'inscription
export interface RegisterCredentials {
  first_name: string
  last_name: string
  username: string
  email: string
  password: string
  password_confirmation: string
}

// Type pour la réponse d'inscription
export interface RegisterResponse {
  success: boolean
  user?: User
  token?: string
  error?: string
}

// Type pour la réponse de l'API Laravel pour l'inscription
interface LaravelRegisterResponse {
  success: boolean
  message?: string
  data?: {
    user: User
    token: string
    token_type: string
  }
  errors?: Record<string, string[]>
}

/**
 * Connexion d'un utilisateur
 */
export const loginUser = async (credentials: LoginCredentials): Promise<LoginResponse> => {
  try {
    const response = await api.post<LaravelLoginResponse>('/login', credentials)
    
    if (response.data.success && response.data.data) {
      const { user, token } = response.data.data
      
      // Sauvegarder le token et les données utilisateur dans localStorage
      localStorage.setItem('auth_token', token)
      localStorage.setItem('user_data', JSON.stringify(user))
      
      return {
        success: true,
        user,
        token
      }
    } else {
      // Retourner une erreur au lieu de la lancer pour éviter les logs console
      return {
        success: false,
        error: response.data.message || 'Erreur de connexion'
      }
    }
  } catch (error) {
    const axiosError = error as AxiosError<LaravelLoginResponse>
    
    // Gérer les erreurs de l'API
    if (axiosError.response) {
      // Erreurs attendues (401, 422) - retourner sans lancer d'exception
      if (axiosError.response.status === 401) {
        return {
          success: false,
          error: axiosError.response.data?.message || 'Identifiants incorrects'
        }
      } else if (axiosError.response.status === 422) {
        // Erreurs de validation
        if (axiosError.response.data?.errors) {
          const firstError = Object.values(axiosError.response.data.errors)[0]
          return {
            success: false,
            error: Array.isArray(firstError) ? firstError[0] : String(firstError)
          }
        }
        return {
          success: false,
          error: axiosError.response.data?.message || 'Données invalides'
        }
      } else if (axiosError.response.data?.message) {
        // Autres erreurs avec message
        return {
          success: false,
          error: axiosError.response.data.message
        }
      } else if (axiosError.response.data?.errors) {
        // Gérer les erreurs de validation Laravel
        const firstError = Object.values(axiosError.response.data.errors)[0]
        return {
          success: false,
          error: Array.isArray(firstError) ? firstError[0] : String(firstError)
        }
      } else if (axiosError.response.status >= 500) {
        // Erreurs serveur - toujours loggées
        console.error('Erreur serveur:', axiosError.response.status)
        return {
          success: false,
          error: 'Erreur serveur. Veuillez réessayer plus tard.'
        }
      } else {
        // Autres erreurs HTTP
        return {
          success: false,
          error: `Erreur ${axiosError.response.status}: ${axiosError.response.statusText}`
        }
      }
    } else if (axiosError.code === 'ECONNABORTED') {
      // Timeout - loggé car c'est une erreur système
      console.error('Timeout détecté:', axiosError.message)
      return {
        success: false,
        error: 'La requête a pris trop de temps. Vérifiez votre connexion internet.'
      }
    } else if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
      // Erreur réseau - loggée car c'est une erreur système
      const errorMessage = 
        'Impossible de se connecter au serveur Laravel.\n\n' +
        'Vérifications à faire :\n' +
        '1. Le serveur Laravel est démarré : php artisan serve\n' +
        '2. L\'API est accessible : http://localhost:8000/api/login\n' +
        '3. CORS est configuré dans Laravel (voir CORS_SETUP.md)\n' +
        '4. Vérifiez la console du navigateur pour plus de détails'
      
      console.error('Erreur réseau détectée:', {
        code: axiosError.code,
        message: axiosError.message,
        url: axiosError.config?.url,
        baseURL: axiosError.config?.baseURL,
      })
      
      return {
        success: false,
        error: errorMessage
      }
    } else if (axiosError.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      console.error('Erreur réseau:', axiosError.message)
      return {
        success: false,
        error: 'Impossible de se connecter au serveur. Vérifiez que l\'API Laravel est démarrée sur http://localhost:8000'
      }
    } else {
      // Une erreur s'est produite lors de la configuration de la requête
      console.error('Erreur de configuration:', axiosError.message)
      return {
        success: false,
        error: 'Erreur de configuration de la requête'
      }
    }
  }
}

/**
 * Inscription d'un utilisateur
 */
export const registerUser = async (credentials: RegisterCredentials): Promise<RegisterResponse> => {
  try {
    const response = await api.post<LaravelRegisterResponse>('/register', credentials)
    
    if (response.data.success && response.data.data) {
      const { user, token } = response.data.data
      
      // Sauvegarder le token et les données utilisateur dans localStorage
      localStorage.setItem('auth_token', token)
      localStorage.setItem('user_data', JSON.stringify(user))
      
      return {
        success: true,
        user,
        token
      }
    } else {
      return {
        success: false,
        error: response.data.message || 'Erreur lors de l\'inscription'
      }
    }
  } catch (error) {
    const axiosError = error as AxiosError<LaravelRegisterResponse>
    
    // Gérer les erreurs de l'API
    if (axiosError.response) {
      // Erreurs de validation (422)
      if (axiosError.response.status === 422) {
        if (axiosError.response.data?.errors) {
          // Récupérer toutes les erreurs de validation
          const errors = axiosError.response.data.errors
          const errorMessages = Object.values(errors).flat()
          return {
            success: false,
            error: errorMessages.join('\n')
          }
        }
        return {
          success: false,
          error: axiosError.response.data?.message || 'Données invalides'
        }
      } else if (axiosError.response.data?.message) {
        // Autres erreurs avec message
        return {
          success: false,
          error: axiosError.response.data.message
        }
      } else if (axiosError.response.status >= 500) {
        // Erreurs serveur
        console.error('Erreur serveur:', axiosError.response.status)
        return {
          success: false,
          error: 'Erreur serveur. Veuillez réessayer plus tard.'
        }
      } else {
        // Autres erreurs HTTP
        return {
          success: false,
          error: `Erreur ${axiosError.response.status}: ${axiosError.response.statusText}`
        }
      }
    } else if (axiosError.code === 'ECONNABORTED') {
      // Timeout
      console.error('Timeout détecté:', axiosError.message)
      return {
        success: false,
        error: 'La requête a pris trop de temps. Vérifiez votre connexion internet.'
      }
    } else if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
      // Erreur réseau
      const errorMessage = 
        'Impossible de se connecter au serveur Laravel.\n\n' +
        'Vérifications à faire :\n' +
        '1. Le serveur Laravel est démarré : php artisan serve\n' +
        '2. L\'API est accessible : http://localhost:8000/api/register\n' +
        '3. CORS est configuré dans Laravel (voir CORS_SETUP.md)\n' +
        '4. Vérifiez la console du navigateur pour plus de détails'
      
      console.error('Erreur réseau détectée:', {
        code: axiosError.code,
        message: axiosError.message,
        url: axiosError.config?.url,
        baseURL: axiosError.config?.baseURL,
      })
      
      return {
        success: false,
        error: errorMessage
      }
    } else if (axiosError.request) {
      // La requête a été faite mais aucune réponse n'a été reçue
      console.error('Erreur réseau:', axiosError.message)
      return {
        success: false,
        error: 'Impossible de se connecter au serveur. Vérifiez que l\'API Laravel est démarrée sur http://localhost:8000'
      }
    } else {
      // Une erreur s'est produite lors de la configuration de la requête
      console.error('Erreur de configuration:', axiosError.message)
      return {
        success: false,
        error: 'Erreur de configuration de la requête'
      }
    }
  }
}

/**
 * Récupérer les données de l'utilisateur connecté
 */
export const getUser = async (): Promise<User> => {
  try {
    // Réduire le timeout pour l'appel d'init afin d'éviter les blocages longs
    const response = await api.get<User>('/user', { timeout: 5000 })
    
    if (response.data) {
      // Mettre à jour les données utilisateur dans localStorage
      localStorage.setItem('user_data', JSON.stringify(response.data))
      return response.data
    } else {
      throw new Error('Impossible de récupérer les données utilisateur')
    }
  } catch (error) {
    const axiosError = error as AxiosError
    
    // Si l'erreur est 401, le token est invalide
    if (axiosError.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
      throw new Error('Session expirée')
    }
    
    // Silencieux pour timeouts et erreurs réseau pendant l'init
    if (axiosError.code === 'ECONNABORTED') {
      throw new Error('Le serveur met trop de temps à répondre')
    }
    if (axiosError.code === 'ERR_NETWORK' || !axiosError.response) {
      throw new Error('Serveur injoignable')
    }
    throw new Error('Erreur lors de la récupération des données utilisateur')
  }
}

/**
 * Déconnexion de l'utilisateur
 */
export const logoutUser = async (): Promise<boolean> => {
  try {
    await api.post('/logout')
    
    // Supprimer le token et les données utilisateur du localStorage
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    
    return true
  } catch (error) {
    // Même en cas d'erreur, supprimer les données locales
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    
    console.error('Erreur lors de la déconnexion:', error)
    return true // On considère la déconnexion comme réussie côté client
  }
}

/**
 * Vérifier si un token existe dans localStorage
 */
export const hasToken = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('auth_token')
}

/**
 * Récupérer le token depuis localStorage
 */
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

/**
 * Récupérer les données utilisateur depuis localStorage
 */
export const getUserFromStorage = (): User | null => {
  if (typeof window === 'undefined') return null
  
  const userData = localStorage.getItem('user_data')
  if (userData) {
    try {
      return JSON.parse(userData) as User
    } catch (error) {
      console.error('Erreur lors du parsing des données utilisateur:', error)
      return null
    }
  }
  
  return null
}
