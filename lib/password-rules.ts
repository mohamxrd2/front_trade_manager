/**
 * Règles du mot de passe, les mêmes que le backend
 * (Password::min(8)->mixedCase()->numbers()->symbols()) — partagées par
 * l'inscription et « Mot de passe oublié ».
 */

export type PasswordRequirement = 'length' | 'upper' | 'lower' | 'digit' | 'special'

/** Clé de traduction du libellé de chaque règle manquante. */
export const PASSWORD_REQUIREMENT_KEYS: Record<PasswordRequirement, string> = {
  length: 'auth.signup.passwordReq8',
  upper: 'auth.signup.passwordReqUpper',
  lower: 'auth.signup.passwordReqLower',
  digit: 'auth.signup.passwordReqDigit',
  special: 'auth.signup.passwordReqSpecial',
}

export function missingPasswordRequirements(pw: string): PasswordRequirement[] {
  const missing: PasswordRequirement[] = []
  if (pw.length < 8) missing.push('length')
  if (!/[A-Z]/.test(pw)) missing.push('upper')
  if (!/[a-z]/.test(pw)) missing.push('lower')
  if (!/[0-9]/.test(pw)) missing.push('digit')
  if (!/[^A-Za-z0-9]/.test(pw)) missing.push('special')
  return missing
}

/** Score de 0 à 4 affiché par la jauge (longueur, majuscule, chiffre, symbole). */
export function passwordScore(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}
