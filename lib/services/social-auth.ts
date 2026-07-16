import type { AxiosError } from 'axios'
import api, { API_BASE_URL, type NoRetryRequestConfig } from '@/lib/api'
import type { User } from '@/lib/auth'

export type SocialAuthProvider = 'google' | 'facebook'

/**
 * Connexion sociale : le backend gère la redirection OAuth initiale et le callback
 * provider, puis renvoie le navigateur vers {FRONTEND_URL}/auth/<provider>/callback?code=XXXX.
 * Le front relaie ensuite ce code au backend via POST {API_URL}/api/auth/<provider>/exchange
 * (voir exchangeSocialAuthCode) pour que la session cookie Sanctum soit créée — Google et
 * Facebook suivent tous les deux ce pattern.
 *
 * L'URL de redirect initiale (SOCIAL_AUTH_URLS) doit être ouverte en navigation plein écran
 * (window.location.href ou <a href>), jamais en fetch/axios : un appel AJAX ne suit pas les
 * redirections vers les pages de consentement Google/Facebook.
 */
export const SOCIAL_AUTH_URLS: Record<SocialAuthProvider, string> = {
  google: `${API_BASE_URL}/api/auth/google/redirect`,
  facebook: `${API_BASE_URL}/api/auth/facebook/redirect`,
}

/**
 * Échange le code renvoyé par un provider social (query param sur
 * /auth/<provider>/callback) contre une session Sanctum. Le cookie CSRF est
 * récupéré automatiquement par l'intercepteur axios (lib/api.ts) avant ce
 * POST, comme pour tout appel mutant.
 *
 * skipRetry: true est indispensable ici — un code OAuth est à usage unique.
 * Le retry automatique de l'instance axios (sur erreur réseau/5xx/419 CSRF)
 * rejoue la requête avec le MÊME body : sans ce flag, un simple 419 ou un 500
 * transitoire renverrait ce même code une seconde fois, que le provider
 * rejette alors (invalid_grant) puisqu'il a déjà été consommé par la 1ère
 * tentative.
 */
export async function exchangeSocialAuthCode(provider: SocialAuthProvider, code: string): Promise<User> {
  try {
    const config: NoRetryRequestConfig = { skipRetry: true }
    const response = await api.post<{ success: boolean; message?: string; data?: { user: User } }>(
      `/api/auth/${provider}/exchange`,
      { code },
      config
    )

    if (response.data.success && response.data.data?.user) {
      return response.data.data.user
    }

    throw new Error(response.data.message || 'Échec de la connexion')
  } catch (error) {
    const axiosError = error as AxiosError<{ success?: boolean; message?: string }>
    const message = axiosError.response?.data?.message
    throw new Error(message || 'Échec de la connexion')
  }
}

export type SocialAuthErrorCode = 'invalid_provider' | 'email_not_shared' | 'social_auth_failed'

const SOCIAL_AUTH_ERROR_MESSAGES: Record<SocialAuthErrorCode, string> = {
  invalid_provider: "Ce fournisseur de connexion n'est pas supporté",
  email_not_shared: "Ton compte doit partager une adresse email pour te connecter",
  social_auth_failed: 'La connexion a échoué, réessaie',
}

/**
 * Traduit le code d'erreur renvoyé par {FRONTEND_URL}/login?error=<code> en message lisible.
 * Retourne null pour un code absent ou inconnu (pas de message spécifique dans ce cas).
 */
export function getSocialAuthErrorMessage(code: string | null): string | null {
  if (!code) return null

  if (code in SOCIAL_AUTH_ERROR_MESSAGES) {
    return SOCIAL_AUTH_ERROR_MESSAGES[code as SocialAuthErrorCode]
  }

  return null
}
