'use client'

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'
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
import { isApiError, ApiErrorType } from '@/lib/api'
import { checkOnboarding as checkOnboardingService } from '@/lib/services/onboarding'
import { ensureQueryCacheForUser } from '@/lib/query-client'
import { displayedAccountIdOf, setDisplayedAccountId, announceSessionChange, onSessionChange } from '@/lib/session-sync'
import { mustChangePassword } from '@/lib/permissions/must-change-password'

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
  /** Présent uniquement si success:true — la page appelante décide où rediriger (ex. ?next=, replace vs push). */
  onboardingComplete?: boolean
  error?: string
  /** Statut HTTP brut de l'échec (401, 403, 429, 500…) — permet à la page d'afficher le texte exact qu'elle veut plutôt que le message générique ci-dessus. */
  status?: number
  /** Type ApiError (ex. "NETWORK_ERROR", "TIMEOUT_ERROR") — pour distinguer une erreur réseau d'un vrai 401/429. */
  errorType?: string
  /** Code métier du backend (ex. "ACCOUNT_SUSPENDED") — pour afficher un message traduit plutôt que `error` (texte brut backend, non traduit). */
  code?: string
  /** Secondes à attendre avant de réessayer, lues depuis l'en-tête Retry-After d'un 429. */
  retryAfterSeconds?: number
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
  onboardingComplete?: boolean
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

  // Dernier compte AFFICHÉ par CET onglet (voir lib/session-sync.ts) — lu
  // dans des gestionnaires d'évènements (cross-onglets, focus) qui ne
  // doivent jamais agir sur une valeur de `user` périmée capturée à leur
  // propre montage (closure).
  const displayedAccountIdRef = useRef<string | null>(null)
  useEffect(() => {
    displayedAccountIdRef.current = user ? displayedAccountIdOf(user) : null
  }, [user])

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
        ensureQueryCacheForUser(userData.id)
        setDisplayedAccountId(displayedAccountIdOf(userData))
        setUser(userData)
        setIsAuthenticated(true)

        // Vérifier l'onboarding si l'utilisateur est connecté
        const currentPath = window.location.pathname
        // Code temporaire à changer : le backend refuserait (403) — la
        // garde de ProtectedRoute envoie de toute façon vers /change-password.
        const skipOnboardingCheck =
          ['/onboarding', '/login', '/register', '/'].includes(currentPath) || mustChangePassword(userData)

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
        setDisplayedAccountId(null)
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

  // Synchro session entre onglets (voir lib/session-sync.ts) : un AUTRE
  // onglet vient de se connecter/déconnecter/changer de compte (cookie
  // Sanctum PARTAGÉ par tous les onglets). On ne fait jamais confiance au
  // signal lui-même — on revérifie toujours sa propre session (GET
  // /api/user) avant d'agir.
  useEffect(() => {
    const unsubscribe = onSessionChange(() => {
      void (async () => {
        try {
          const freshUser = await getUser()
          const freshAccountId = freshUser ? displayedAccountIdOf(freshUser) : null
          const previousAccountId = displayedAccountIdRef.current

          setDisplayedAccountId(freshAccountId)
          setUser(freshUser)
          setIsAuthenticated(!!freshUser)

          // "Le compte a changé" = toujours authentifié, mais un AUTRE
          // compte qu'avant — pas une simple déconnexion détectée ici.
          if (freshUser && freshAccountId !== previousAccountId) {
            ensureQueryCacheForUser(freshUser.id)

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('session:account-switched', { detail: { email: freshUser.email } })
              )
            }
          }
        } catch {
          // getUser() a échoué (réseau, 500) : on garde l'état actuel plutôt
          // que de déconnecter cet onglet sur une simple erreur passagère.
        }
      })()
    })

    return unsubscribe
  }, [])

  // Au retour sur cet onglet (changement d'onglet, ou de fenêtre/appli) :
  // revérifie que l'utilisateur affiché est toujours celui de la session
  // réelle — filet de sécurité pour le cas où le signal cross-onglets
  // ci-dessus aurait été manqué (onglet suspendu par le navigateur). Un
  // écart déclenche un rechargement complet plutôt qu'une simple mise à
  // jour d'état : plus sûr qu'une resynchronisation partielle du cache.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const revalidating = { current: false }

    const revalidate = async () => {
      if (revalidating.current) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

      revalidating.current = true
      try {
        const freshUser = await getUser()
        const freshAccountId = freshUser ? displayedAccountIdOf(freshUser) : null

        if (freshAccountId !== displayedAccountIdRef.current) {
          window.location.reload()
        }
      } catch {
        // Erreur réseau passagère au retour sur l'onglet : ne pas recharger pour autant.
      } finally {
        revalidating.current = false
      }
    }

    const handleVisibility = () => { void revalidate() }
    const handleFocus = () => { void revalidate() }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
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
    //
    // Ne redirige PAS ici (ni push ni replace) : la page appelante (/login)
    // décide de la cible exacte (?next=, /onboarding, /dashboard) et de la
    // sémantique (replace, pour que retour arrière ne revienne pas sur
    // /login) — ce n'est pas cette fonction qui doit l'imposer globalement.
    try {
      // Réinitialiser les Analytics avant la connexion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:reset'))
      }

      // Appeler loginApi qui utilise l'intercepteur pour récupérer le CSRF automatiquement
      const userData = await loginApi(credentials)

      // Si ce compte diffère du dernier utilisateur ayant rempli le cache
      // persistant (navigateur partagé entre plusieurs comptes), tout vider
      // AVANT que le moindre composant ne monte et ne lise une valeur
      // périmée appartenant à l'autre compte.
      ensureQueryCacheForUser(userData.id)
      setDisplayedAccountId(displayedAccountIdOf(userData))
      // Prévient les AUTRES onglets : si l'un d'eux était resté affiché sur
      // un compte différent, il le détectera (voir l'effet onSessionChange
      // ci-dessous) et rechargera son utilisateur.
      announceSessionChange()

      // Mettre à jour l'état avec l'utilisateur retourné
      setUser(userData)
      setIsAuthenticated(true)

      let onboardingComplete = true
      try {
        const onboardingStatus = await checkOnboardingService()
        onboardingComplete = onboardingStatus.is_complete
      } catch (onboardingError) {
        // 404 : l'onboarding n'existe pas encore → traité comme incomplet.
        // Toute autre erreur : on ne bloque pas la connexion dessus, on
        // suppose l'onboarding complété (comportement déjà existant).
        const axiosError = onboardingError as { response?: { status?: number } }
        onboardingComplete = axiosError?.response?.status !== 404
      }

      // Attendre un court instant avant de charger les nouvelles données Analytics
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('analytics:refresh'))
        }, 100)
      }

      return { success: true, user: userData, onboardingComplete }
    } catch (error: unknown) {
      // Email non vérifié : le backend a déjà envoyé un code (les identifiants
      // étaient corrects) — router vers le même écran de vérification que
      // l'inscription plutôt que d'afficher un échec de connexion classique.
      if (isApiError(error) && error.code === 'EMAIL_NOT_VERIFIED') {
        const data = error.data as { email?: string; expires_in?: number } | undefined

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
        // Pas d'email exploitable dans data (ne devrait pas arriver) : on
        // retombe sur la gestion d'erreur générique ci-dessous.
      }

      setIsAuthenticated(false)
      setUser(null)

      if (isApiError(error)) {
        const retryAfterHeader = error.originalError?.response?.headers?.['retry-after']
        return {
          success: false,
          status: error.status,
          errorType: error.type,
          code: error.code,
          retryAfterSeconds: retryAfterHeader ? Number(retryAfterHeader) : undefined,
          error: error.message,
        }
      }

      return { success: false, error: 'Erreur de connexion' }
    }
  }, [])

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
      // registerApi() throw une ApiError (voir lib/api.ts), pas une
      // AxiosError imbriquée sous `.response` — lire la mauvaise forme
      // faisait que `fieldErrors` n'était JAMAIS rempli sur un vrai 422
      // (ex. email déjà utilisé), peu importe la réponse réelle du backend.
      if (isApiError(error)) {
        if (error.status === 422 && error.errors && typeof error.errors === 'object') {
          const fieldErrors = error.errors as Record<string, string[]>
          const allErrors = Object.values(fieldErrors).flat()
          return {
            success: false,
            error: allErrors.length > 0 ? allErrors.join('\n') : error.message || 'Données invalides',
            errors: fieldErrors,
          }
        }
        if (error.status === 502) {
          return { success: false, error: error.message || "Impossible d'envoyer l'email de vérification. Réessayez." }
        }
        if (error.type === ApiErrorType.SERVER) {
          return { success: false, error: 'Erreur serveur. Veuillez réessayer plus tard.' }
        }
        if (error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT) {
          return { success: false, error: 'Erreur de connexion. Vérifiez votre connexion internet.' }
        }
        return { success: false, error: error.message || "Erreur lors de l'inscription" }
      }

      return { success: false, error: "Erreur lors de l'inscription" }
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
    // AuthRoute démonte/remonte l'écran de vérification à chaque tentative
    // de code (et efface le code tapé, le countdown, etc.) — voir le
    // commentaire détaillé au-dessus de login(). Ne redirige pas non plus :
    // la page /verify décide (replace vers /onboarding ou /dashboard).
    try {
      // Réinitialiser les Analytics avant la connexion
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:reset'))
      }

      const userData = await verifyRegistrationCodeApi(payload)

      ensureQueryCacheForUser(userData.id)
      setDisplayedAccountId(displayedAccountIdOf(userData))
      announceSessionChange()
      setUser(userData)
      setIsAuthenticated(true)

      let onboardingComplete = true
      try {
        const onboardingStatus = await checkOnboardingService()
        onboardingComplete = onboardingStatus.is_complete
      } catch (onboardingError) {
        const axiosError = onboardingError as { response?: { status?: number } }
        onboardingComplete = axiosError?.response?.status !== 404
      }

      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('analytics:refresh'))
        }, 100)
      }

      return { success: true, user: userData, onboardingComplete }
    } catch (error: unknown) {
      // verifyRegistrationCodeApi() throw une ApiError (voir lib/api.ts) —
      // `status`/`message` sont directement sur l'erreur, PAS sous
      // `error.response.status` (forme AxiosError) : lire la mauvaise forme
      // faisait retomber TOUTE erreur (422 code faux, 410 expiré, 429 trop
      // de tentatives…) sur le message générique réseau ci-dessous, peu
      // importe la vraie cause.
      setIsAuthenticated(false)
      setUser(null)

      if (isApiError(error)) {
        if (error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT) {
          return { success: false, error: 'Erreur de connexion. Vérifiez votre connexion internet.', status: error.status }
        }
        return { success: false, error: error.message, status: error.status }
      }

      return { success: false, error: 'Code invalide' }
    }
  }, [])

  /**
   * Régénère un code de vérification pour une inscription en attente.
   */
  const resendRegistrationCode = useCallback(async (email: string): Promise<ResendRegistrationResult> => {
    try {
      const pending = await resendRegistrationCodeApi(email)
      return { success: true, email: pending.email, expiresIn: pending.expiresIn }
    } catch (error: unknown) {
      // Même remarque que verifyRegistration() ci-dessus : resendRegistrationCodeApi()
      // throw une ApiError, pas une AxiosError imbriquée sous `.response`.
      if (isApiError(error)) {
        if (error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT) {
          return { success: false, error: 'Erreur de connexion. Vérifiez votre connexion internet.', status: error.status }
        }
        return { success: false, error: error.message, status: error.status }
      }

      return { success: false, error: 'Erreur lors du renvoi du code' }
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
      // Vider le cache persistant : sinon il survit à la déconnexion (il vit
      // dans localStorage) et se présenterait, instantanément et sans
      // requête, au prochain compte qui se connecte sur ce navigateur.
      ensureQueryCacheForUser(null)
      setDisplayedAccountId(null)
      // Prévient les AUTRES onglets, qui rechargeront leur utilisateur
      // (voir l'effet onSessionChange ci-dessous) et se retrouveront aussi
      // déconnectés.
      announceSessionChange()

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

