/**
 * Pont langue courante ↔ code hors-React (intercepteur axios, qui est un
 * singleton de module, pas un composant — il ne peut pas lire le contexte
 * React). LanguageContext est la SEULE source qui appelle setCurrentLanguage
 * ; tout le reste ne fait que lire via getCurrentLanguage/getCurrentLocale.
 *
 * Lecture initiale (avant même le premier rendu de LanguageContext, ex. pour
 * la toute première requête API déclenchée par un composant monté plus tôt)
 * via le cookie — c'est aussi ce cookie qui permet au <html lang> d'être
 * correct dès le rendu serveur, sans clignotement (voir LanguageContext).
 */

export type AppLanguage = 'fr' | 'en'

export const LANGUAGE_COOKIE_NAME = 'app-language'

function readLanguageCookie(): AppLanguage | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE_NAME}=([^;]+)`))
  const value = match?.[1]
  return value === 'fr' || value === 'en' ? value : null
}

let currentLanguage: AppLanguage = readLanguageCookie() ?? 'fr'

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage
}

/** 'fr-FR' / 'en-US' — pour Intl.NumberFormat/DateTimeFormat/RelativeTimeFormat. */
export function getCurrentLocale(): string {
  return currentLanguage === 'en' ? 'en-US' : 'fr-FR'
}

export function setCurrentLanguage(lang: AppLanguage): void {
  currentLanguage = lang
}

export function writeLanguageCookie(lang: AppLanguage): void {
  if (typeof document === 'undefined') return
  // 1 an, path=/ : lisible par toutes les pages, y compris publiques
  // (accueil, connexion, inscription) avant toute authentification.
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}
