import type { User } from '@/lib/auth'

/**
 * Chantier "Équipe" §5 — tant qu'un membre n'a pas remplacé son code
 * temporaire (`must_change_password`), le backend refuse toute route sauf
 * /api/me/change-code, /api/user et /api/logout (403 MUST_CHANGE_PASSWORD,
 * voir EnsureNotMustChangePassword côté backend). Côté front, une seule page
 * est alors accessible : /change-password — y compris après le bouton
 * Retour, un rechargement ou une URL tapée à la main.
 */
export const CHANGE_PASSWORD_ROUTE = '/change-password'

/** Code d'erreur renvoyé par le backend dans ce cas (403). */
export const MUST_CHANGE_PASSWORD_ERROR_CODE = 'MUST_CHANGE_PASSWORD'

/** Évènement global émis par l'intercepteur axios (lib/api.ts) sur ce 403. */
export const MUST_CHANGE_PASSWORD_EVENT = 'auth:must-change-password'

export function mustChangePassword(user: Pick<User, 'must_change_password'> | null | undefined): boolean {
  return Boolean(user?.must_change_password)
}

/** La route où renvoyer l'utilisateur, ou `null` s'il peut rester où il est. */
export function mustChangePasswordRedirect(
  user: Pick<User, 'must_change_password'> | null | undefined,
  pathname: string | null
): string | null {
  if (!mustChangePassword(user)) return null
  return pathname === CHANGE_PASSWORD_ROUTE ? null : CHANGE_PASSWORD_ROUTE
}
