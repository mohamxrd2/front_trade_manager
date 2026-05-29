import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Types d'erreurs API possibles
 */
export enum ApiErrorType {
  NETWORK = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  CORS = 'CORS_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION = 'VALIDATION_ERROR',
  SERVER = 'SERVER_ERROR',
  CSRF = 'CSRF_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR',
}

/**
 * Interface pour une erreur API structurée
 */
export interface ApiError extends Error {
  type: ApiErrorType
  status?: number
  url?: string
  silent?: boolean
  isRetryable?: boolean
  originalError?: AxiosError
}

/**
 * Configuration du retry
 */
interface RetryConfig {
  maxRetries: number
  retryDelay: number
  retryableStatuses: number[]
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 30000, // 30 secondes
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
}

const RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000, // 1 seconde entre chaque retry
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Statuts HTTP retryables
}

// ============================================================================
// ÉTAT GLOBAL
// ============================================================================

let xsrfToken: string | null = null
let csrfPromise: Promise<void> | null = null
let isLoggingOut = false
let isRedirectingToLogin = false

// ============================================================================
// FONCTIONS UTILITAIRES EXPORTÉES
// ============================================================================

export function setLoggingOut(value: boolean): void {
  isLoggingOut = value
}

export function getIsLoggingOut(): boolean {
  return isLoggingOut
}

export function setRedirectingToLogin(value: boolean): void {
  isRedirectingToLogin = value
}

export function getIsRedirectingToLogin(): boolean {
  return isRedirectingToLogin
}

// ============================================================================
// FONCTIONS UTILITAIRES INTERNES
// ============================================================================

/**
 * Logger conditionnel (uniquement en dev)
 */
const logger = {
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[API]', ...args)
    }
  },
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[API]', ...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[API]', ...args)
    }
  },
  error: (...args: unknown[]) => {
    console.error('[API]', ...args)
  },
}

/**
 * Délai avec Promise
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calcule le délai de retry avec backoff exponentiel
 */
function getRetryDelay(attempt: number): number {
  return RETRY_CONFIG.retryDelay * Math.pow(2, attempt - 1)
}

/**
 * Vérifie si l'erreur est une erreur réseau
 */
function isNetworkError(error: AxiosError): boolean {
  return (
    !error.response &&
    error.code !== 'ECONNABORTED' &&
    (error.message === 'Network Error' ||
      error.message.includes('Network Error') ||
      error.code === 'ERR_NETWORK')
  )
}

/**
 * Vérifie si l'erreur est une erreur CORS
 */
function isCorsError(error: AxiosError): boolean {
  // CORS errors typically don't have a response and may show specific patterns
  if (!error.response && error.message === 'Network Error') {
    // Check if it's likely CORS (browser blocks the response entirely)
    return typeof window !== 'undefined' && !navigator.onLine === false
  }
  return false
}

/**
 * Vérifie si l'erreur est un timeout
 */
function isTimeoutError(error: AxiosError): boolean {
  return (
    error.code === 'ECONNABORTED' ||
    error.message.includes('timeout') ||
    error.code === 'ETIMEDOUT'
  )
}

/**
 * Vérifie si la requête peut être retentée
 */
function isRetryable(error: AxiosError): boolean {
  // Network errors are retryable
  if (isNetworkError(error)) return true

  // Timeout errors are retryable
  if (isTimeoutError(error)) return true

  // Some HTTP status codes are retryable
  if (error.response?.status) {
    return RETRY_CONFIG.retryableStatuses.includes(error.response.status)
  }

  return false
}

/**
 * Crée une erreur API structurée
 */
function createApiError(
  message: string,
  type: ApiErrorType,
  options: {
    status?: number
    url?: string
    silent?: boolean
    isRetryable?: boolean
    originalError?: AxiosError
  } = {}
): ApiError {
  const error = new Error(message) as ApiError
  error.type = type
  error.status = options.status
  error.url = options.url
  error.silent = options.silent ?? false
  error.isRetryable = options.isRetryable ?? false
  error.originalError = options.originalError
  return error
}

/**
 * Détermine le type d'erreur à partir d'une erreur Axios
 */
function getErrorType(error: AxiosError): ApiErrorType {
  if (isTimeoutError(error)) return ApiErrorType.TIMEOUT
  if (isCorsError(error)) return ApiErrorType.CORS
  if (isNetworkError(error)) return ApiErrorType.NETWORK

  const status = error.response?.status

  switch (status) {
    case 401:
      return ApiErrorType.UNAUTHORIZED
    case 403:
      return ApiErrorType.FORBIDDEN
    case 404:
      return ApiErrorType.NOT_FOUND
    case 419:
      return ApiErrorType.CSRF
    case 422:
      return ApiErrorType.VALIDATION
    case 500:
    case 502:
    case 503:
    case 504:
      return ApiErrorType.SERVER
    default:
      return ApiErrorType.UNKNOWN
  }
}

/**
 * Génère un message d'erreur lisible
 */
function getErrorMessage(error: AxiosError, type: ApiErrorType): string {
  const defaultMessages: Record<ApiErrorType, string> = {
    [ApiErrorType.NETWORK]: 'Erreur de connexion réseau. Vérifiez votre connexion internet.',
    [ApiErrorType.TIMEOUT]: 'La requête a expiré. Le serveur met trop de temps à répondre.',
    [ApiErrorType.CORS]: 'Erreur CORS. Le serveur n\'autorise pas cette origine.',
    [ApiErrorType.UNAUTHORIZED]: 'Session expirée. Veuillez vous reconnecter.',
    [ApiErrorType.FORBIDDEN]: 'Accès refusé. Vous n\'avez pas les permissions nécessaires.',
    [ApiErrorType.NOT_FOUND]: 'Ressource introuvable.',
    [ApiErrorType.VALIDATION]: 'Données invalides.',
    [ApiErrorType.SERVER]: 'Erreur serveur. Veuillez réessayer plus tard.',
    [ApiErrorType.CSRF]: 'Token de sécurité expiré. Veuillez rafraîchir la page.',
    [ApiErrorType.UNKNOWN]: 'Une erreur inattendue s\'est produite.',
  }

  // Try to extract message from response
  const responseData = error.response?.data as { message?: string; error?: string } | undefined
  const serverMessage = responseData?.message || responseData?.error

  return serverMessage || defaultMessages[type]
}

// ============================================================================
// GESTION CSRF
// ============================================================================

function extractCsrfTokenFromCookies(cookies: string): string | null {
  if (!cookies) return null

  const patterns = [/XSRF-TOKEN=([^;]+)/i, /xsrf-token=([^;]+)/i]

  for (const pattern of patterns) {
    const match = cookies.match(pattern)
    if (match?.[1]) {
      return decodeURIComponent(match[1])
    }
  }

  return null
}

function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  return extractCsrfTokenFromCookies(document.cookie)
}

async function getCsrfCookie(): Promise<void> {
  if (csrfPromise) {
    await csrfPromise
    return
  }

  csrfPromise = api
    .get('/sanctum/csrf-cookie')
    .then(async () => {
      let attempts = 0
      const maxAttempts = 10
      const delayMs = 50

      while (attempts < maxAttempts) {
        const token = readCsrfTokenFromCookie()
        if (token) {
          xsrfToken = token
          logger.debug('✅ Token CSRF récupéré', `(tentative ${attempts + 1})`)
          csrfPromise = null
          return
        }

        await delay(delayMs)
        attempts++
      }

      logger.warn('⚠️ Token CSRF non trouvé après plusieurs tentatives')
      csrfPromise = null
    })
    .catch((error) => {
      csrfPromise = null
      logger.debug('⚠️ CSRF cookie non disponible:', error?.message || 'Erreur inconnue')
    })

  return csrfPromise
}

// ============================================================================
// CRÉATION DE L'INSTANCE AXIOS
// ============================================================================

const api: AxiosInstance = axios.create(API_CONFIG)

// ============================================================================
// INTERCEPTEUR DE REQUÊTE
// ============================================================================

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toUpperCase()
    const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '')
    const url = `${config.baseURL || ''}${config.url || ''}`

    // Log de la requête sortante
    logger.info(`📤 ${method} ${config.url}`)

    // Skip CSRF for the CSRF cookie request itself
    if (config.url === '/sanctum/csrf-cookie') {
      return config
    }

    // Handle CSRF token for mutating requests
    if (needsCsrf) {
      try {
        if (!xsrfToken && typeof document !== 'undefined') {
          xsrfToken = readCsrfTokenFromCookie()
        }

        if (!xsrfToken) {
          logger.debug('🔄 Récupération du cookie CSRF pour:', config.url)
          await getCsrfCookie()
          xsrfToken = readCsrfTokenFromCookie()

          if (!xsrfToken && typeof document !== 'undefined') {
            await delay(100)
            xsrfToken = readCsrfTokenFromCookie()

            if (!xsrfToken) {
              await delay(100)
              xsrfToken = readCsrfTokenFromCookie()
            }
          }
        }

        if (xsrfToken && config.headers) {
          config.headers['X-XSRF-TOKEN'] = xsrfToken
          logger.debug('📤 Header X-XSRF-TOKEN ajouté')
        } else {
          logger.error('❌ Token CSRF non disponible pour:', config.url)
        }
      } catch (error) {
        logger.debug('⚠️ Erreur lors de la récupération du cookie CSRF:', error)
      }
    }

    return config
  },
  (error) => {
    logger.error('❌ Erreur intercepteur requête:', error.message)
    return Promise.reject(error)
  }
)

// ============================================================================
// INTERCEPTEUR DE RÉPONSE AVEC RETRY
// ============================================================================

api.interceptors.response.use(
  (response: AxiosResponse) => {
    const { config, status } = response
    const method = config.method?.toUpperCase()

    // Log de la réponse réussie
    logger.info(`✅ ${method} ${config.url} → ${status}`)

    // Update CSRF token if available
    if (typeof document !== 'undefined') {
      const token = readCsrfTokenFromCookie()
      if (token) {
        xsrfToken = token
      }
    }

    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
      _retryCount?: number
    }

    const status = error.response?.status
    const method = originalRequest?.method?.toUpperCase()
    const url = originalRequest?.url

    // ✅ URLs de polling qui ne doivent pas logger d'erreurs en boucle
    const isPollingRequest = url?.includes('notifications') || 
                             url?.includes('unread-count') ||
                             url?.includes('health')

    // Log de l'erreur (sauf pour les requêtes de polling)
    if (!isPollingRequest) {
      if (status) {
        logger.warn(`❌ ${method} ${url} → ${status}`)
      } else if (isNetworkError(error)) {
        logger.error(`🔌 Network Error: ${method} ${url}`)
      } else if (isTimeoutError(error)) {
        logger.error(`⏱️ Timeout: ${method} ${url}`)
      } else {
        logger.error(`❌ Error: ${method} ${url} → ${error.message}`)
      }
    }

    // Déterminer le type d'erreur
    const errorType = getErrorType(error)
    const errorMessage = getErrorMessage(error, errorType)

    // ========================================================================
    // RETRY AUTOMATIQUE POUR LES ERREURS RÉSEAU/TIMEOUT
    // ========================================================================
    if (
      isRetryable(error) &&
      originalRequest &&
      (originalRequest._retryCount ?? 0) < RETRY_CONFIG.maxRetries
    ) {
      originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1
      const retryDelay = getRetryDelay(originalRequest._retryCount)

      logger.info(
        `🔄 Retry ${originalRequest._retryCount}/${RETRY_CONFIG.maxRetries} dans ${retryDelay}ms pour ${url}`
      )

      await delay(retryDelay)
      return api(originalRequest)
    }

    // ========================================================================
    // GESTION ERREUR 419 (CSRF)
    // ========================================================================
    if (status === 419 && originalRequest && !originalRequest._retry) {
      logger.warn('⚠️ Erreur 419 - Récupération d\'un nouveau token CSRF')

      originalRequest._retry = true
      xsrfToken = null

      try {
        await getCsrfCookie()
        await delay(200)

        const newToken = readCsrfTokenFromCookie()
        if (newToken) {
          xsrfToken = newToken
          if (originalRequest.headers) {
            originalRequest.headers['X-XSRF-TOKEN'] = newToken
          }
          logger.debug('✅ Nouveau token CSRF, nouvelle tentative')
          return api(originalRequest)
        }
      } catch (csrfError) {
        logger.error('❌ Impossible de récupérer un nouveau token CSRF:', csrfError)
      }
    }

    // ========================================================================
    // GESTION ERREUR 401 (NON AUTHENTIFIÉ)
    // ========================================================================
    if (status === 401 && !isLoggingOut) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname
        const protectedRoutes = [
          '/dashboard',
          '/wallet',
          '/analytics',
          '/products',
          '/collaborators',
          '/notifications',
          '/settings',
          '/onboarding',
          '/account',
        ]

        const isProtectedRoute = protectedRoutes.some((route) =>
          currentPath.startsWith(route)
        )

        if (isProtectedRoute && currentPath !== '/login') {
          if (isRedirectingToLogin) {
            return Promise.reject(
              createApiError('Redirection vers login en cours', ApiErrorType.UNAUTHORIZED, {
                status: 401,
                url,
                silent: true,
              })
            )
          }

          isRedirectingToLogin = true
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))

          setTimeout(() => {
            window.location.href = '/login'
          }, 50)

          return Promise.reject(
            createApiError('Session expirée', ApiErrorType.UNAUTHORIZED, {
              status: 401,
              url,
              silent: true,
            })
          )
        }
      }
    }

    // Erreur 401 pendant la déconnexion → silencieuse
    if (status === 401 && isLoggingOut) {
      return Promise.reject(
        createApiError('Déconnexion en cours', ApiErrorType.UNAUTHORIZED, {
          status: 401,
          url,
          silent: true,
        })
      )
    }

    // ========================================================================
    // GESTION ERREUR 403 (FORBIDDEN)
    // ========================================================================
    if (status === 403) {
      logger.warn('🚫 Accès refusé:', url)
      return Promise.reject(
        createApiError(errorMessage, ApiErrorType.FORBIDDEN, {
          status: 403,
          url,
          originalError: error,
        })
      )
    }

    // ========================================================================
    // GESTION ERREURS 5XX (SERVEUR)
    // ========================================================================
    if (status && status >= 500) {
      logger.error('💥 Erreur serveur:', status, url)
      return Promise.reject(
        createApiError(errorMessage, ApiErrorType.SERVER, {
          status,
          url,
          isRetryable: true,
          originalError: error,
        })
      )
    }

    // ========================================================================
    // ERREUR GÉNÉRIQUE
    // ========================================================================
    return Promise.reject(
      createApiError(errorMessage, errorType, {
        status,
        url,
        isRetryable: isRetryable(error),
        originalError: error,
      })
    )
  }
)

// ============================================================================
// EXPORT
// ============================================================================

export default api

/**
 * Helper pour vérifier le type d'une erreur
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'type' in error && typeof (error as ApiError).type === 'string'
}

/**
 * Helper pour obtenir le message d'erreur approprié
 */
export function getApiErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Une erreur inattendue s\'est produite'
}
