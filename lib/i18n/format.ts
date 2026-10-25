import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
// Charge les données de locale française une fois pour toutes (l'anglais est
// déjà intégré par défaut à dayjs) — nécessaire pour que `.locale('fr')|
// fonctionne ici, indépendamment de l'ordre d'import des autres fichiers de
// l'app qui faisaient jusqu'ici le même import ailleurs.
import 'dayjs/locale/fr'
import type { AppLanguage } from './current-language'

dayjs.extend(relativeTime)

/**
 * Helper de formatage UNIQUE pour toute l'app — dates, nombres, montants,
 * dates relatives. Dérive le format de la LANGUE passée en argument (jamais
 * d'un `dayjs.locale()` global : régler le locale dayjs globalement est un
 * singleton partagé par tout le process, donc le dernier composant monté
 * "gagnait" pour toute l'app, quelle que soit la langue réellement active —
 * c'était une partie du bug "l'anglais ne change presque rien").
 *
 * La DEVISE est un réglage utilisateur indépendant de la langue (section 3
 * du besoin) : un compte en FCFA affiche "1 245 000 FCFA" aussi bien en
 * français qu'en anglais — seuls les SÉPARATEURS de milliers/décimales
 * suivent la langue (1 245 000 en fr, 1,245,000 en en).
 */

function toLocale(language: AppLanguage): string {
  return language === 'en' ? 'en-US' : 'fr-FR'
}

/** Symbole/suffixe par devise — même mapping que l'ancien lib/utils/currency.ts, pour ne pas changer l'affichage existant. */
const CURRENCY_DISPLAY: Record<string, { prefix?: string; suffix?: string }> = {
  EUR: { suffix: ' €' },
  USD: { prefix: '$' },
  GBP: { prefix: '£' },
  JPY: { prefix: '¥' },
  CNY: { prefix: '¥' },
  INR: { prefix: '₹' },
  BRL: { prefix: 'R$ ' },
  CAD: { prefix: 'C$' },
  AUD: { prefix: 'A$' },
  CHF: { suffix: ' CHF' },
  NGN: { prefix: '₦' },
  ZAR: { prefix: 'R ' },
  EGP: { prefix: 'E£' },
  XOF: { suffix: ' XOF' },
  FCFA: { suffix: ' FCFA' },
}

/**
 * Formate un montant avec la devise choisie dans les paramètres — la devise
 * ne change jamais avec la langue, seuls les séparateurs numériques suivent
 * `language`.
 */
export function formatMoney(amount: number | string, currency: string | undefined, language: AppLanguage): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (Number.isNaN(numAmount)) return '0'

  const formattedNumber = new Intl.NumberFormat(toLocale(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount)

  const display = CURRENCY_DISPLAY[currency ?? 'FCFA'] ?? CURRENCY_DISPLAY.FCFA
  return `${display.prefix ?? ''}${formattedNumber}${display.suffix ?? ''}`
}

/** Nombre simple (quantités, pourcentages…) — "1 245" (fr) / "1,245" (en). */
export function formatNumber(value: number, language: AppLanguage, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(toLocale(language), options).format(value)
}

/**
 * Date/heure localisée. `pattern` utilise la syntaxe dayjs — on passe un
 * dayjs dont le LOCALE est réglé juste pour cet appel (`.locale(lang)`,
 * jamais `dayjs.locale()` global, voir note en tête de fichier), donc deux
 * composants qui formatent dans deux langues différentes au même instant ne
 * se marchent jamais dessus.
 */
export function formatDate(date: string | Date, language: AppLanguage, pattern = 'D MMM YYYY'): string {
  return dayjs(date).locale(language).format(pattern)
}

export function formatDateTime(date: string | Date, language: AppLanguage): string {
  return formatDate(date, language, language === 'en' ? 'MMM D, YYYY · h:mm A' : 'D MMM YYYY · HH:mm')
}

export function formatTime(date: string | Date, language: AppLanguage): string {
  return formatDate(date, language, language === 'en' ? 'h:mm A' : 'HH:mm')
}

/** "il y a 12 min" / "12 minutes ago" — via Intl.RelativeTimeFormat (pas le plugin dayjs, pour un contrôle fin des unités). */
export function formatRelative(date: string | Date, language: AppLanguage, now: Date = new Date()): string {
  const target = dayjs(date)
  const diffSeconds = target.diff(now, 'second')
  const rtf = new Intl.RelativeTimeFormat(toLocale(language), { numeric: 'auto' })

  const absSeconds = Math.abs(diffSeconds)
  // Chaque entrée : (durée en secondes de cette unité, nom de l'unité),
  // de la plus grande à la plus petite — on prend la première dont le seuil
  // tient au moins une fois dans l'écart, pour obtenir "12 minutes ago"
  // plutôt que "720 seconds ago".
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60 * 60 * 24 * 365, 'year'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24, 'day'],
    [60 * 60, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ]

  const [unitSeconds, unit] = units.find(([seconds]) => absSeconds >= seconds) ?? units[units.length - 1]
  const value = Math.round(diffSeconds / unitSeconds)
  return rtf.format(value, unit)
}
