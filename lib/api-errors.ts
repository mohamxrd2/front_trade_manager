/**
 * Erreurs de l'API : quel message afficher, et quand réessayer tout seul.
 * Logique pure (sans axios ni navigateur), testée dans api-errors.test.ts.
 */

/** Types d'erreurs API possibles. */
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

export interface FailureInfo {
  /** Le serveur a-t-il répondu (même par une erreur) ? */
  hasResponse: boolean
  status?: number
  /** Délai axios dépassé. */
  timedOut: boolean
  /** navigator.onLine */
  online: boolean
  /** Développement : une requête sans réponse est alors très probablement un vrai refus CORS. */
  isDev: boolean
}

/**
 * Type d'erreur. Une requête sans réponse n'est PAS forcément une erreur
 * CORS : serveur qui se réveille, coupure, erreur de proxy… Le navigateur
 * ne dit pas la différence. En production on parle donc d'un serveur qui
 * ne répond pas ; le message technique « CORS » est réservé au
 * développement, où c'est presque toujours la vraie cause.
 */
export function classifyFailure(info: FailureInfo): ApiErrorType {
  if (!info.online) return ApiErrorType.NETWORK
  if (info.timedOut) return ApiErrorType.TIMEOUT
  if (!info.hasResponse) return info.isDev ? ApiErrorType.CORS : ApiErrorType.TIMEOUT

  switch (info.status) {
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
  }
  if (info.status !== undefined && info.status >= 500) return ApiErrorType.SERVER
  return ApiErrorType.UNKNOWN
}

/** Clé de traduction du message par défaut (messages/{fr,en}/errors.json → api). */
export const API_ERROR_MESSAGE_KEYS: Record<ApiErrorType, string> = {
  [ApiErrorType.NETWORK]: 'errors.api.offline',
  [ApiErrorType.TIMEOUT]: 'errors.api.slow',
  [ApiErrorType.CORS]: 'errors.api.cors',
  [ApiErrorType.UNAUTHORIZED]: 'errors.api.unauthorized',
  [ApiErrorType.FORBIDDEN]: 'errors.api.forbidden',
  [ApiErrorType.NOT_FOUND]: 'errors.api.notFound',
  [ApiErrorType.VALIDATION]: 'errors.api.validation',
  [ApiErrorType.SERVER]: 'errors.api.server',
  [ApiErrorType.CSRF]: 'errors.api.csrf',
  [ApiErrorType.UNKNOWN]: 'errors.api.unknown',
}

/** Erreurs où le message du serveur (s'il y en a un) est moins utile que le nôtre. */
export const GENERIC_MESSAGE_TYPES = new Set<ApiErrorType>([
  ApiErrorType.NETWORK,
  ApiErrorType.TIMEOUT,
  ApiErrorType.CORS,
  ApiErrorType.SERVER,
])

/** Erreurs pour lesquelles on affiche la référence de la requête (à donner au support). */
export const REFERENCE_TYPES = new Set<ApiErrorType>([
  ApiErrorType.TIMEOUT,
  ApiErrorType.CORS,
  ApiErrorType.SERVER,
  ApiErrorType.UNKNOWN,
])

/* ---------- Nouvel essai automatique ---------- */

export const AUTO_RETRY_DELAY_MS = 3000
export const MAX_AUTO_RETRIES = 1

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const UNAVAILABLE_STATUSES = new Set([502, 503, 504])

export interface RetryContext {
  method?: string
  type: ApiErrorType
  status?: number
  retryCount: number
  /** La requête a demandé à ne jamais être rejouée (codes à usage unique…). */
  skipRetry?: boolean
  /** Requête qui peut être rejouée une fois même si elle n'est pas un GET (la connexion). */
  retryOnceWhenUnavailable?: boolean
}

/**
 * Un seul nouvel essai, 3 s plus tard, quand le serveur n'a pas répondu ou
 * était indisponible (502/503/504) — jamais hors ligne, jamais sur un refus
 * (4xx). Seulement pour une requête sans effet (GET…), ou pour la connexion,
 * qui est sans danger à rejouer : rejouer une vente risquerait de la créer
 * deux fois.
 */
export function shouldAutoRetry(ctx: RetryContext): boolean {
  if (ctx.retryCount >= MAX_AUTO_RETRIES) return false
  const method = (ctx.method ?? 'GET').toUpperCase()
  const replayable = ctx.retryOnceWhenUnavailable || (SAFE_METHODS.has(method) && !ctx.skipRetry)
  if (!replayable) return false

  if (ctx.type === ApiErrorType.TIMEOUT) return true
  return ctx.type === ApiErrorType.SERVER && ctx.status !== undefined && UNAVAILABLE_STATUSES.has(ctx.status)
}

/* ---------- Identifiant de requête ---------- */

/** Identifiant envoyé dans X-Request-Id : on retrouve la requête dans les logs du serveur. */
export function newRequestId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`
  return `w-${random}`
}

/** Forme courte affichée à l'utilisateur (les 8 premiers caractères utiles). */
export function shortRequestId(id: string | null | undefined): string | null {
  if (!id) return null
  const compact = id.replace(/^w-/, '').replace(/-/g, '')
  return compact.slice(0, 8) || null
}
