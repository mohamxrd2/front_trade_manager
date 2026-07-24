'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  login as loginApi,
  register as registerApi,
  verifyRegistrationCode as verifyRegistrationCodeApi,
  resendRegistrationCode as resendRegistrationCodeApi,
  logout as logoutApi,
  getUser,
  type User,
  type LoginCredentials,
  type RegisterData,
  type VerifyRegistrationPayload,
} from '@/lib/auth'
import { isApiError } from '@/lib/api'
import { checkOnboarding as checkOnboardingService } from '@/lib/services/onboarding'

/**
 * Types pour le contexte d'authentification
 */
/**
 * Résultat de la connexion classique. `emailVerificationRequired` est renseigné
 * quand le backend renvoie 403 EMAIL_NOT_VERIFIED : les identifiants sont
 * corrects mais l'email n'est pas encore vérifié — un code vient d'être
 * envoyé, il faut router vers l'écran de vérification (pas un échec classique).
 */
export interface LoginResult {
  success: boolean
  user?: User
  error?: string
  emailVerificationRequired?: { email: string; expiresIn: number }
}

/**
 * Résultat de l'étape 1 de l'inscription (envoi du code de vérification) :
 * le compte n'est pas encore créé, avec gestion des erreurs de validation par champ.
 */
export interface RegisterInitResult {
  success: boolean
  email?: string
  expiresIn?: number
  error?: string
  errors?: Record<string, string[]> // Erreurs de validation par champ
}

/**
 * Résultat de l'étape 2 de l'inscription (vérification du code).
 * `status` permet à l'UI de distinguer 422 (code incorrect) / 404 (inscription
 * introuvable) / 410 (expiré) / 429 (trop de tentatives).
 */
export interface VerifyRegistrationResult {
  success: boolean
  user?: User
  error?: string
  status?: number
}

/**
 * Résultat du renvoi de code. `status` permet de distinguer 404 (inscription
 * en attente introuvable, ex: après trop longtemps).
 */
export interface ResendRegistrationResult {
  success: boolean
  email?: string
  expiresIn?: number
  error?: string
  status?: number
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<LoginResult>
  register: (data: RegisterData) => Promise<RegisterInitResult>
  verifyRegistration: (payload: VerifyRegistrationPayload) => Promise<VerifyRegistrationResult>
  resendRegistrationCode: (email: string) => Promise<ResendRegistrationResult>
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
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
   * 
   * Comportement:
   * - getUser() retourne null si non authentifié (401) → état normal, pas d'erreur
   * - getUser() retourne User si authentifié
   * - getUser() peut throw uniquement pour les vraies erreurs (500, etc.)
   */
  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      // getUser() retourne null si 401 (non authentifié) - c'est normal
      const userData = await getUser()

      if (userData) {
        // ✅ Utilisateur authentifié
        setUser(userData)
        setIsAuthenticated(true)

        // Vérifier l'onboarding si l'utilisateur est connecté
        const currentPath = window.location.pathname
        const skipOnboardingCheck = ['/onboarding', '/login', '/register', '/'].includes(currentPath)

        if (!skipOnboardingCheck) {
          try {
            const onboardingStatus = await checkOnboardingService()

            if (!onboardingStatus.is_complete) {
              router.push('/onboarding')
            }
          } catch (onboardingError) {
            // Si erreur 404, l'onboarding n'existe pas encore
            const axiosError = onboardingError as { response?: { status?: number } }
            if (axiosError?.response?.status === 404) {
              router.push('/onboarding')
            }
            // Pour les autres erreurs, continuer silencieusement
          }
        }

        return true
      } else {
        // ✅ Non authentifié (getUser a retourné null)
        // C'est un état NORMAL après déconnexion ou première visite
        // Pas de log d'erreur ici
        setUser(null)
        setIsAuthenticated(false)
        return false
      }
    } catch (error: unknown) {
      // ⚠️ Vraie erreur (500, etc.) - getUser a throw
      // Ne devrait presque jamais arriver car getUser gère les erreurs réseau
      if (process.env.NODE_ENV !== 'production') {
        console.warn('checkAuth: Erreur inattendue', error)
      }

      // En cas d'erreur, considérer comme non authentifié
      setUser(null)
      setIsAuthenticated(false)
      return false
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
  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    // Ne PAS toggle le flag `loading` global ici : AuthRoute s'en sert pour
    // décider d'afficher {children} ou un spinner, donc setLoading(true)
    // démonte LoginForm en plein milieu de la requête, et setLoading(false)
    // en remonte une toute NEUVE ensuite — ce qui efface silencieusement
    // tout state local (ex: l'écran de vérification EMAIL_NOT_VERIFIED) sans
    // la moindre erreur. `loading` ne doit représenter QUE la vérification
    // de session initiale ; le spinner de "connexion en cours" est déjà géré
    // par le state local `isLoading` du formulaire.
    try {
      // Réinitialiser les Analytics avant la connexion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:reset'))
      }

      // Appeler loginApi qui utilise l'intercepteur pour récupérer le CSRF automatiquement
      const userData = await loginApi(credentials)

      // Mettre à jour l'état avec l'utilisateur retourné
      setUser(userData)
      setIsAuthenticated(true)

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
      // Email non vérifié : le backend a déjà envoyé un code (les identifiants
      // étaient corrects) — router vers le même écran de vérification que
      // l'inscription plutôt que d'afficher un échec de connexion classique.
      if (isApiError(error) && error.code === 'EMAIL_NOT_VERIFIED') {
        const data = error.data as { email?: string; expires_in?: number } | undefined

        // TEMP DEBUG — à retirer une fois le flow validé en prod
        console.log('🔍 [AuthContext] login(): EMAIL_NOT_VERIFIED intercepté', { code: error.code, data })

        setIsAuthenticated(false)
        setUser(null)

        if (data?.email) {
          return {
            success: false,
            emailVerificationRequired: {
              email: data.email,
              expiresIn: data.expires_in ?? 600,
            },
          }
        }

        console.log('🔍 [AuthContext] EMAIL_NOT_VERIFIED sans data.email exploitable, fallback erreur générique', data)
        // Pas d'email exploitable dans data (ne devrait pas arriver) : on
        // retombe sur la gestion d'erreur générique ci-dessous.
      }

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

      setIsAuthenticated(false)
      setUser(null)

      return {
        success: false,
        error: errorMessage
      }
    }
  }, [router])

  /**
   * Étape 1/2 de l'inscription : envoie les infos du compte, déclenche
   * l'envoi du code de vérification par email. Ne touche PAS à l'état
   * d'authentification global — le compte n'existe pas encore.
   *
   * Gère les erreurs de validation (422) avec les erreurs par champ.
   */
  const register = useCallback(async (data: RegisterData): Promise<RegisterInitResult> => {
    try {
      const pending = await registerApi(data)
      return { success: true, email: pending.email, expiresIn: pending.expiresIn }
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
      // Erreur 502 : Échec d'envoi de l'email de vérification
      else if (axiosError?.response?.status === 502) {
        errorMessage = axiosError.response.data?.message || 'Impossible d\'envoyer l\'email de vérification. Réessayez.'
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
      }

      return {
        success: false,
        error: errorMessage,
        errors: fieldErrors
      }
    }
  }, [])

  /**
   * Étape 2/2 de l'inscription : vérifie le code à 5 chiffres et finalise
   * la création du compte. En cas de succès, l'utilisateur est déjà
   * connecté via cookie (comme login()) — on synchronise l'état global et
   * on redirige vers le dashboard.
   */
  const verifyRegistration = useCallback(async (payload: VerifyRegistrationPayload): Promise<VerifyRegistrationResult> => {
    // Même remarque que login() : ne pas toggle `loading` ici, sinon
    // AuthRoute démonte/remonte VerifyCodeScreen à chaque tentative de code
    // (et efface le code tapé, le countdown, etc.) — voir le commentaire
    // détaillé au-dessus de login().
    try {
      // Réinitialiser les Analytics avant la connexion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:reset'))
      }

      const userData = await verifyRegistrationCodeApi(payload)

      setUser(userData)
      setIsAuthenticated(true)

      router.push('/dashboard')

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('analytics:refresh'))
        }, 100)
      }

      return { success: true, user: userData }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string }; status?: number }
        message?: string
        code?: string
      }

      const status = axiosError?.response?.status
      let errorMessage = 'Code invalide'

      if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message
      } else if (axiosError?.code === 'ERR_NETWORK' || !axiosError?.response) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.'
      } else if (axiosError?.message) {
        errorMessage = axiosError.message
      }

      setIsAuthenticated(false)
      setUser(null)

      return { success: false, error: errorMessage, status }
    }
  }, [router])

  /**
   * Régénère un code de vérification pour une inscription en attente.
   */
  const resendRegistrationCode = useCallback(async (email: string): Promise<ResendRegistrationResult> => {
    try {
      const pending = await resendRegistrationCodeApi(email)
      return { success: true, email: pending.email, expiresIn: pending.expiresIn }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { message?: string }; status?: number }
        message?: string
        code?: string
      }

      const status = axiosError?.response?.status
      let errorMessage = 'Erreur lors du renvoi du code'

      if (axiosError?.response?.data?.message) {
        errorMessage = axiosError.response.data.message
      } else if (axiosError?.code === 'ERR_NETWORK' || !axiosError?.response) {
        errorMessage = 'Erreur de connexion. Vérifiez votre connexion internet.'
      } else if (axiosError?.message) {
        errorMessage = axiosError.message
      }

      return { success: false, error: errorMessage, status }
    }
  }, [])

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
    verifyRegistration,
    resendRegistrationCode,
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
export type { User, LoginCredentials, RegisterData, VerifyRegistrationPayload }

