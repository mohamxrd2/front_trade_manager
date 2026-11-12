/**
 * « Mot de passe oublié » — logique pure des 3 écrans (testable sans DOM) :
 * /forgot-password → /reset-password/verify → /reset-password/new.
 */

export const CODE_LENGTH = 6
export const RESEND_COOLDOWN = 60

export const FORGOT_PATH = '/forgot-password'
export const VERIFY_PATH = '/reset-password/verify'
export const NEW_PASSWORD_PATH = '/reset-password/new'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/** Valeur initiale du champ e-mail : ?email=… s'il ressemble à un e-mail. */
export function initialEmail(param: string | null): string {
  const value = (param ?? '').trim()
  return isEmail(value) ? value : ''
}

export function withEmail(path: string, email: string): string {
  const value = email.trim()
  return value ? `${path}?email=${encodeURIComponent(value)}` : path
}

/**
 * Lien « Mot de passe oublié ? » de la connexion, selon ce qui est saisi :
 * un e-mail est repris sur l'écran suivant ; un identifiant (membre d'équipe,
 * qui n'a pas d'e-mail) n'ouvre pas le parcours, on affiche le message
 * « Demandez à votre responsable ». Champ vide : le parcours normal.
 */
export function forgotLinkTarget(identifier: string): { kind: 'member' } | { kind: 'link'; href: string } {
  const value = identifier.trim()
  if (value && !isEmail(value)) return { kind: 'member' }
  return { kind: 'link', href: withEmail(FORGOT_PATH, value) }
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/* ---------- Jeton entre l'écran 2 et l'écran 3 (sessionStorage, jamais l'URL) ---------- */

export const RESET_STORAGE_KEY = 'waelly.password-reset'

export interface ResetTicket {
  email: string
  token: string
  /** Horodatage (ms) d'expiration du jeton. */
  expiresAt: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function saveResetTicket(ticket: ResetTicket, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(RESET_STORAGE_KEY, JSON.stringify(ticket))
  } catch {
    // Stockage indisponible : l'écran 3 renverra vers l'écran 1.
  }
}

/** Le jeton s'il existe et n'a pas expiré, sinon null (et il est effacé). */
export function loadResetTicket(storage: StorageLike | null = browserStorage(), now = Date.now()): ResetTicket | null {
  try {
    const raw = storage?.getItem(RESET_STORAGE_KEY)
    if (!raw) return null
    const ticket = JSON.parse(raw) as Partial<ResetTicket>
    if (typeof ticket.email === 'string' && typeof ticket.token === 'string' && typeof ticket.expiresAt === 'number' && ticket.expiresAt > now) {
      return ticket as ResetTicket
    }
    storage?.removeItem(RESET_STORAGE_KEY)
    return null
  } catch {
    return null
  }
}

export function clearResetTicket(storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.removeItem(RESET_STORAGE_KEY)
  } catch {
    // rien à faire
  }
}

/* ---------- Messages d'erreur ---------- */

export interface ResetApiFailure {
  status?: number
  code?: string
  remaining?: number
  network?: boolean
}

export type ResetErrorMessage = { key: string; params?: Record<string, number> }

/** Erreur du serveur → clé de traduction (jamais le texte brut du backend). */
export function resetErrorMessage(error: ResetApiFailure): ResetErrorMessage {
  if (error.network) return { key: 'auth.forgot.networkError' }
  switch (error.code) {
    case 'TOO_MANY_REQUESTS':
      return { key: 'auth.forgot.tooManyRequests' }
    case 'CODE_EXPIRED':
      return { key: 'auth.forgot.codeExpired' }
    case 'TOO_MANY_ATTEMPTS':
      return { key: 'auth.forgot.tooManyAttempts' }
    case 'TOKEN_INVALID':
      return { key: 'auth.forgot.tokenInvalid' }
    case 'INVALID_CODE':
      return typeof error.remaining === 'number'
        ? { key: 'auth.forgot.incorrectCodeWithRemaining', params: { remaining: error.remaining } }
        : { key: 'auth.forgot.incorrectCode' }
  }
  if (error.status === 429) return { key: 'auth.forgot.tooManyRequests' }
  return { key: 'auth.forgot.genericError' }
}
