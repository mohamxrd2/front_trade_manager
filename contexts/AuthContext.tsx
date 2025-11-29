'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { login as loginApi, register as registerApi, logout as logoutApi, getUser, type User, type LoginCredentials, type RegisterData } from '@/lib/auth'
import { checkOnboarding as checkOnboardingService } from '@/lib/services/onboarding'

/**
 * Types pour le contexte d'authentification
 */
/**
 * Résultat d'inscription avec gestion des erreurs par champ
 */
export interface RegisterResult {
  success: boolean
  user?: User
  error?: string
  errors?: Record<string, string[]> // Erreurs de validation par champ
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; user?: User; error?: string }>
  register: (data: RegisterData) => Promise<RegisterResult>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

// Créer le contexte d'authentification
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Hook personnalisé pour utiliser le contexte d'authentification
 * 
 * @returns Le contexte d'authentification
 * @throws Erreur si utilisé en dehors d'un AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return context
}

// Props pour AuthProvider
interface AuthProviderProps {
  children: ReactNode
}

/**
 * Provider d'authentification pour Laravel Sanctum avec cookies HTTP-only
 * 
 * Architecture:
 * - Le token est dans un cookie HttpOnly (géré par Laravel)
 * - Pas de localStorage pour le token
 * - Au montage, appelle checkAuth() qui utilise getUser() pour vérifier la session
 * - Redirige vers /login si la session est invalide (401) sur les routes protégées
 * - L'utilisateur reste connecté après refresh grâce aux cookies
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const router = useRouter()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  /**
   * Vérifie l'état d'authentification en appelant getUser()
   * Retourne null si non authentifié (401), sinon retourne l'utilisateur
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      if (typeof window === 'undefined') {
        return
      }

      const userData = await getUser()

      if (userData) {
        // Utilisateur authentifié
        setUser(userData)
        setIsAuthenticated(true)
        
        // Vérifier l'onboarding si l'utilisateur est connecté
        // Ne rediriger que si on n'est pas déjà sur la page d'onboarding ou de login
        const currentPath = window.location.pathname
        if (currentPath !== '/onboarding' && currentPath !== '/login' && currentPath !== '/register') {
          try {
            const onboardingStatus = await checkOnboardingService()
            
            if (!onboardingStatus.is_complete) {
              // Rediriger vers l'onboarding si non complété
              router.push('/onboarding')
            }
          } catch (onboardingError) {
            // Si erreur 404, l'onboarding n'existe pas encore, rediriger vers onboarding
            const axiosError = onboardingError as { response?: { status?: number } }
            if (axiosError?.response?.status === 404) {
              router.push('/onboarding')
            }
            // Pour les autres erreurs, ne rien faire (on laisse l'utilisateur continuer)
          }
        }
      } else {
        // Non authentifié (401)
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error: unknown) {
      // Erreur réseau ou serveur (pas 401)
      const err = error as Error & { code?: string; response?: { status?: number } }
      const isNetworkError = err?.code === 'ERR_NETWORK' || !err?.response

      if (process.env.NODE_ENV !== 'production' && isNetworkError) {
        console.debug('Erreur réseau lors de la vérification de session:', err?.message || 'Serveur inaccessible')
      }

      // En cas d'erreur réseau, on ne change pas l'état (on ne sait pas si on est connecté ou non)
      // En cas d'erreur serveur autre que 401, on considère comme non authentifié
      if (!isNetworkError) {
        setUser(null)
        setIsAuthenticated(false)
      }
    }
  }, [router])

  // Initialiser l'authentification au montage
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      await checkAuth()
      setLoading(false)
    }

    initAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Écouter les événements d'erreur 401 depuis l'intercepteur API
  useEffect(() => {
    const handleUnauthorized = () => {
      // Mettre à jour l'état d'authentification
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
      
      // Réinitialiser le flag de redirection après un court délai
      // pour permettre de nouvelles redirections si nécessaire
      if (typeof window !== 'undefined') {
        setTimeout(async () => {
          try {
            const { setRedirectingToLogin } = await import('@/lib/api')
            setRedirectingToLogin(false)
          } catch {
            // Ignorer les erreurs d'import
          }
        }, 1000)
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  /**
   * Fonction de connexion
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      setLoading(true)

      // Réinitialiser les Analytics avant la connexion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:reset'))
      }

      // Appeler loginApi qui utilise l'intercepteur pour récupérer le CSRF automatiquement
      const userData = await loginApi(credentials)

      // Mettre à jour l'état avec l'utilisateur retourné
      setUser(userData)
      setIsAuthenticated(true)
      setLoading(false)

      // Vérifier l'onboarding après la connexion
      try {
        const onboardingStatus = await checkOnboardingService()
        
        if (!onboardingStatus.is_complete) {
          // Rediriger vers l'onboarding si non complété
          router.push('/onboarding')
          return { success: true, user: userData }
        } else {
          // Rediriger vers le dashboard si onboarding complété
          router.push('/dashboard')
        }
      } catch (onboardingError) {
        // Si erreur 404, l'onboarding n'existe pas encore, rediriger vers onboarding
        const axiosError = onboardingError as { response?: { status?: number } }
        if (axiosError?.response?.status === 404) {
          router.push('/onboarding')
        } else {
          // Pour les autres erreurs, rediriger quand même vers le dashboard
          router.push('/dashboard')
        }
      }

      // Attendre un court instant avant de charger les nouvelles données Analytics
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('analytics:refresh'))
        }, 100)
      }

      return { success: true, user: userData }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { message?: string }; status?: number }; message?: string }

      // Extraire le message d'erreur
      let errorMessage = 'Erreur de connexion'

      if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message
      } else if (axiosError?.message) {
        errorMessage = axiosError.message
      } else if (axiosError?.response?.status === 401) {
        errorMessage = 'Identifiants invalides'
      } else if (axiosError?.response?.status === 422) {
        errorMessage = 'Données invalides'
      }

      setLoading(false)
      setIsAuthenticated(false)
      setUser(null)

      return {
        success: false,
        error: errorMessage
      }
    }
  }, [router])

  /**
   * Fonction d'inscription
   * 
   * Gère les erreurs de validation (422) avec les erreurs par champ
   */
  const register = useCallback(async (data: RegisterData): Promise<RegisterResult> => {
    try {
      setLoading(true)

      // Appeler registerApi qui utilise l'intercepteur pour récupérer le CSRF automatiquement
      const userData = await registerApi(data)

      // Mettre à jour l'état avec l'utilisateur retourné
      // L'utilisateur est automatiquement connecté après l'inscription
      setUser(userData)
      setIsAuthenticated(true)
      setLoading(false)

      // Après l'inscription, toujours rediriger vers l'onboarding
      router.push('/onboarding')

      return { success: true, user: userData }
    } catch (error: unknown) {
      const axiosError = error as { 
        response?: { 
          data?: { 
            message?: string
            errors?: Record<string, string[]>
          }
          status?: number
        }
        message?: string
        code?: string
      }

      // Extraire le message d'erreur et les erreurs par champ
      let errorMessage = 'Erreur lors de l\'inscription'
      let fieldErrors: Record<string, string[]> | undefined = undefined

      // Erreur 422 : Validation Laravel
      if (axiosError?.response?.status === 422 && axiosError?.response?.data?.errors) {
        fieldErrors = axiosError.response.data.errors
        // Créer un message général à partir des erreurs
        const allErrors = Object.values(fieldErrors).flat()
        errorMessage = allErrors.length > 0 
          ? allErrors.join('\n')
          : axiosError.response.data.message || 'Données invalides'
      }
      // Erreur 500 : Serveur
      else if (axiosError?.response?.status === 500) {
        errorMessage = 'Erreur serveur. Veuillez réessayer plus tard.'
      }
      // Erreur réseau
      else if (axiosError?.code === 'ERR_NETWORK' || !axiosError?.response) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.'
      }
      // Autres erreurs
      else if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message
      } else if (axiosError?.message) {
        errorMessage = axiosError.message
      } else if (axiosError?.response?.status === 401) {
        errorMessage = 'Non autorisé'
      }

      setLoading(false)
      setIsAuthenticated(false)
      setUser(null)

      return {
        success: false,
        error: errorMessage,
        errors: fieldErrors
      }
    }
  }, [router])

  /**
   * Fonction de déconnexion
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      
      // Nettoyer l'état immédiatement pour éviter les appels API après déconnexion
      setUser(null)
      setIsAuthenticated(false)
      
      // Réinitialiser les Analytics avant la déconnexion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:reset'))
      }
      
      // Appeler logoutApi qui utilise l'intercepteur pour récupérer le CSRF automatiquement
      // Cette requête peut échouer avec 401, c'est normal, on l'ignore
      await logoutApi().catch(() => {
        // Ignorer silencieusement les erreurs de déconnexion
      })
    } catch {
      // Même en cas d'erreur, nettoyer côté client
      // Ne pas logger les erreurs pendant la déconnexion
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
      // Utiliser window.location pour forcer une redirection complète et éviter les appels API
      // Cela annule toutes les requêtes en cours
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      } else {
        router.push('/login')
      }
    }
  }, [router])

  // Valeur du contexte
  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Exporter les types pour utilisation ailleurs
export type { User, LoginCredentials, RegisterData }

