import { ApiError, ApiErrorType, isApiError, getApiErrorMessage } from '../api'

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorHandlerOptions {
  /** Si true, ne pas afficher de notification toast */
  silent?: boolean
  /** Message personnalisé à afficher */
  customMessage?: string
  /** Callback à exécuter après le traitement de l'erreur */
  onError?: (error: ApiError | Error) => void
}

export interface ErrorResult {
  type: ApiErrorType | 'UNKNOWN'
  message: string
  status?: number
  isRetryable: boolean
  shouldShowToast: boolean
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Vérifie si une erreur doit être ignorée silencieusement
 * (par exemple, pendant la déconnexion ou la redirection)
 */
export function isSilentError(error: unknown): boolean {
  if (!error) return false

  // Check if it's an ApiError with silent flag
  if (isApiError(error) && error.silent) {
    return true
  }

  // Legacy support for old error format
  const legacyError = error as Error & { 
    silent?: boolean
    isLoggingOut?: boolean 
  }

  if (legacyError.silent === true || legacyError.isLoggingOut === true) {
    return true
  }

  // Check error message patterns
  const errorMessage = (error as Error)?.message || ''
  const silentPatterns = [
    'Unauthorized during logout',
    'Ignoring',
    'Redirecting to login',
    '(silent)',
    'Déconnexion en cours',
    'Session expirée',
    'Redirection vers login',
  ]

  return silentPatterns.some((pattern) => errorMessage.includes(pattern))
}

/**
 * Vérifie si l'erreur est une erreur réseau
 */
export function isNetworkError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.type === ApiErrorType.NETWORK
  }

  const message = (error as Error)?.message || ''
  return message === 'Network Error' || message.includes('Network Error')
}

/**
 * Vérifie si l'erreur est une erreur d'authentification (401/403)
 */
export function isAuthError(error: unknown): boolean {
  if (isApiError(error)) {
    return (
      error.type === ApiErrorType.UNAUTHORIZED ||
      error.type === ApiErrorType.FORBIDDEN
    )
  }

  const axiosError = error as { response?: { status?: number } }
  const status = axiosError?.response?.status
  return status === 401 || status === 403
}

/**
 * Vérifie si l'erreur est une erreur serveur (5xx)
 */
export function isServerError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.type === ApiErrorType.SERVER
  }

  const axiosError = error as { response?: { status?: number } }
  const status = axiosError?.response?.status
  return typeof status === 'number' && status >= 500
}

/**
 * Vérifie si l'erreur est une erreur de validation (422)
 */
export function isValidationError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.type === ApiErrorType.VALIDATION
  }

  const axiosError = error as { response?: { status?: number } }
  return axiosError?.response?.status === 422
}

/**
 * Vérifie si l'erreur peut être retentée
 */
export function isRetryableError(error: unknown): boolean {
  if (isApiError(error)) {
    return error.isRetryable ?? false
  }

  // Network and timeout errors are generally retryable
  if (isNetworkError(error)) return true

  // Server errors (5xx) are generally retryable
  if (isServerError(error)) return true

  return false
}

/**
 * Extrait le code de statut HTTP de l'erreur
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isApiError(error)) {
    return error.status
  }

  const axiosError = error as { response?: { status?: number } }
  return axiosError?.response?.status
}

/**
 * Traite une erreur et retourne un résultat structuré
 */
export function processError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): ErrorResult {
  const { silent = false, customMessage } = options

  // Determine if we should show a toast
  const shouldShowToast = !silent && !isSilentError(error)

  // Get error type and message
  if (isApiError(error)) {
    return {
      type: error.type,
      message: customMessage || error.message,
      status: error.status,
      isRetryable: error.isRetryable ?? false,
      shouldShowToast,
    }
  }

  // Fallback for non-ApiError
  const status = getErrorStatus(error)
  let type: ApiErrorType | 'UNKNOWN' = 'UNKNOWN'

  if (isNetworkError(error)) {
    type = ApiErrorType.NETWORK
  } else if (status === 401) {
    type = ApiErrorType.UNAUTHORIZED
  } else if (status === 403) {
    type = ApiErrorType.FORBIDDEN
  } else if (status && status >= 500) {
    type = ApiErrorType.SERVER
  }

  return {
    type,
    message: customMessage || getApiErrorMessage(error),
    status,
    isRetryable: isRetryableError(error),
    shouldShowToast,
  }
}

/**
 * Fonction pour gérer les erreurs 401 en vérifiant si elles doivent être ignorées
 */
export function handle401Error(
  error: unknown,
  defaultMessage = 'Non authentifié'
): never {
  if (isSilentError(error)) {
    throw error
  }

  throw new Error(defaultMessage)
}

/**
 * Crée un handler d'erreur réutilisable pour les composants
 */
export function createErrorHandler(
  showToast: (message: string, type: 'error' | 'warning') => void
) {
  return function handleError(
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): ErrorResult {
    const result = processError(error, options)

    if (result.shouldShowToast) {
      const toastType = result.type === ApiErrorType.SERVER ? 'error' : 'warning'
      showToast(options.customMessage || result.message, toastType)
    }

    if (options.onError) {
      if (isApiError(error)) {
        options.onError(error)
      } else {
        options.onError(error as Error)
      }
    }

    return result
  }
}

/**
 * Messages d'erreur par défaut par type
 */
export const DEFAULT_ERROR_MESSAGES: Record<ApiErrorType, string> = {
  [ApiErrorType.NETWORK]: 'Erreur de connexion réseau. Vérifiez votre connexion internet.',
  [ApiErrorType.TIMEOUT]: 'La requête a expiré. Le serveur met trop de temps à répondre.',
  [ApiErrorType.CORS]: "Erreur CORS. Le serveur n'autorise pas cette origine.",
  [ApiErrorType.UNAUTHORIZED]: 'Session expirée. Veuillez vous reconnecter.',
  [ApiErrorType.FORBIDDEN]: "Accès refusé. Vous n'avez pas les permissions nécessaires.",
  [ApiErrorType.NOT_FOUND]: 'Ressource introuvable.',
  [ApiErrorType.VALIDATION]: 'Données invalides.',
  [ApiErrorType.SERVER]: 'Erreur serveur. Veuillez réessayer plus tard.',
  [ApiErrorType.CSRF]: 'Token de sécurité expiré. Veuillez rafraîchir la page.',
  [ApiErrorType.UNKNOWN]: "Une erreur inattendue s'est produite.",
}

/**
 * Obtient le message d'erreur par défaut pour un type d'erreur
 */
export function getDefaultErrorMessage(type: ApiErrorType): string {
  return DEFAULT_ERROR_MESSAGES[type] || DEFAULT_ERROR_MESSAGES[ApiErrorType.UNKNOWN]
}
