import { resolveICUPlural } from './icu-plural'
import type { AppLanguage } from './current-language'

import frCommon from '@/messages/fr/common.json'
import frNav from '@/messages/fr/nav.json'
import frDashboard from '@/messages/fr/dashboard.json'
import frProducts from '@/messages/fr/products.json'
import frTransactions from '@/messages/fr/transactions.json'
import frWallet from '@/messages/fr/wallet.json'
import frAnalytics from '@/messages/fr/analytics.json'
import frChart from '@/messages/fr/chart.json'
import frCollaborators from '@/messages/fr/collaborators.json'
import frNotifications from '@/messages/fr/notifications.json'
import frSettings from '@/messages/fr/settings.json'
import frErrors from '@/messages/fr/errors.json'
import frSuccess from '@/messages/fr/success.json'
import frCompany from '@/messages/fr/company.json'
import frInvoices from '@/messages/fr/invoices.json'
import frClients from '@/messages/fr/clients.json'
import frOnboarding from '@/messages/fr/onboarding.json'

import enCommon from '@/messages/en/common.json'
import enNav from '@/messages/en/nav.json'
import enDashboard from '@/messages/en/dashboard.json'
import enProducts from '@/messages/en/products.json'
import enTransactions from '@/messages/en/transactions.json'
import enWallet from '@/messages/en/wallet.json'
import enAnalytics from '@/messages/en/analytics.json'
import enChart from '@/messages/en/chart.json'
import enCollaborators from '@/messages/en/collaborators.json'
import enNotifications from '@/messages/en/notifications.json'
import enSettings from '@/messages/en/settings.json'
import enErrors from '@/messages/en/errors.json'
import enSuccess from '@/messages/en/success.json'
import enCompany from '@/messages/en/company.json'
import enInvoices from '@/messages/en/invoices.json'
import enClients from '@/messages/en/clients.json'
import enOnboarding from '@/messages/en/onboarding.json'

export type TranslationKey = string
export type TranslationValue = string | { [key: string]: TranslationValue }
export type TranslationObject = Record<string, TranslationValue>

// Un fichier par domaine (messages/{fr,en}/*.json), fusionnés ici sous la
// même forme imbriquée qu'avant (un objet par langue) — l'API de t() et les
// clés pointées ("wallet.addExpense") ne changent pas, seule l'organisation
// des fichiers sources change (plus facile à faire évoluer lot par lot que
// deux fichiers monolithiques de ~900 lignes chacun). Pur (pas de React),
// pour rester testable sans jsdom.
export const translations: Record<AppLanguage, TranslationObject> = {
  fr: {
    common: frCommon,
    nav: frNav,
    dashboard: frDashboard,
    products: frProducts,
    transactions: frTransactions,
    wallet: frWallet,
    analytics: frAnalytics,
    chart: frChart,
    collaborators: frCollaborators,
    notifications: frNotifications,
    settings: frSettings,
    errors: frErrors,
    success: frSuccess,
    company: frCompany,
    invoices: frInvoices,
    clients: frClients,
    onboarding: frOnboarding,
  },
  en: {
    common: enCommon,
    nav: enNav,
    dashboard: enDashboard,
    products: enProducts,
    transactions: enTransactions,
    wallet: enWallet,
    analytics: enAnalytics,
    chart: enChart,
    collaborators: enCollaborators,
    notifications: enNotifications,
    settings: enSettings,
    errors: enErrors,
    success: enSuccess,
    company: enCompany,
    invoices: enInvoices,
    clients: enClients,
    onboarding: enOnboarding,
  },
}

/** Descend dans un objet de traduction suivant une clé "a.b.c" — `undefined` si absente. */
function lookup(tree: TranslationObject, key: TranslationKey): string | undefined {
  const keys = key.split('.')
  let value: TranslationValue = tree

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      return undefined
    }
  }

  return typeof value === 'string' ? value : undefined
}

/**
 * Résout une clé pour une langue donnée. Le français reste la langue de
 * repli : une clé manquante en anglais ne doit JAMAIS afficher la clé brute
 * ("wallet.title") à l'utilisateur — seule une clé manquante dans LES DEUX
 * langues retombe sur la clé brute (ça ne devrait jamais arriver en prod si
 * `npm run i18n:check` est vert).
 */
export function translate(
  key: TranslationKey,
  language: AppLanguage,
  params?: Record<string, string | number>
): string {
  let value = lookup(translations[language], key)
  let usedFallback = false

  if (value === undefined && language !== 'fr') {
    value = lookup(translations.fr, key)
    usedFallback = true
  }

  if (value === undefined) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Translation key not found (fr et ${language}): ${key}`)
    }
    return key
  }

  if (usedFallback && process.env.NODE_ENV !== 'production') {
    console.warn(`Translation key missing in "${language}", repli français: ${key}`)
  }

  let resolved = value
  const pluralRules = new Intl.PluralRules(language === 'en' ? 'en-US' : 'fr-FR')

  if (resolved.includes(', plural,')) {
    resolved = resolveICUPlural(resolved, params, pluralRules)
  }

  if (params) {
    resolved = resolved.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      const paramValue = params[paramKey]
      return paramValue !== undefined ? String(paramValue) : match
    })
  }

  return resolved
}
