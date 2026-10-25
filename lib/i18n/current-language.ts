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

// ============================================================================
// Pseudo-langue "xx" — DÉVELOPPEMENT UNIQUEMENT (jamais en production, voir
// garde process.env.NODE_ENV dans chaque fonction ci-dessous). N'affecte pas
// la langue réelle (traductions, formats, Accept-Language) : seulement
// l'affichage, entoure chaque texte réellement traduit de ⟦ ⟧ pour repérer
// d'un coup d'œil tout texte qui ne l'est pas. Activable par ?lang=xx ou un
// réglage dev dans Paramètres ; persiste via sessionStorage (survit à la
// navigation client une fois le paramètre d'URL retiré).
// ============================================================================

const PSEUDO_STORAGE_KEY = 'app-pseudo-lang'
const isDev = process.env.NODE_ENV !== 'production'

function readPseudoModeFromStorage(): boolean {
  if (!isDev || typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(PSEUDO_STORAGE_KEY) === 'xx'
  } catch {
    return false
  }
}

function readPseudoModeFromUrl(): boolean {
  if (!isDev || typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('lang') === 'xx'
}

let pseudoModeEnabled = readPseudoModeFromStorage() || readPseudoModeFromUrl()

export function isPseudoModeEnabled(): boolean {
  return isDev && pseudoModeEnabled
}

export function setPseudoMode(enabled: boolean): void {
  if (!isDev) return
  pseudoModeEnabled = enabled
  if (typeof window !== 'undefined') {
    try {
      if (enabled) window.sessionStorage.setItem(PSEUDO_STORAGE_KEY, 'xx')
      else window.sessionStorage.removeItem(PSEUDO_STORAGE_KEY)
    } catch {
      // sessionStorage indisponible (navigation privée stricte, etc.) — le
      // flag en mémoire du module reste correct pour la session en cours.
    }
  }
}
