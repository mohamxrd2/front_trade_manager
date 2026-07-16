'use client'

import { useLanguage } from '../context/LanguageContext'
import frTranslations from '../translations/fr.json'
import enTranslations from '../translations/en.json'

type TranslationKey = string
type TranslationObject = Record<string, any>

const translations: Record<'fr' | 'en', TranslationObject> = {
  fr: frTranslations,
  en: enTranslations,
}

export function useTranslation() {
  const { language } = useLanguage()

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = translations[language]

    // Naviguer dans l'objet de traduction
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        // Si la clé n'existe pas, retourner la clé elle-même
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Translation key not found: ${key}`)
        }
        return key
      }
    }

    // Si la valeur finale est une chaîne, remplacer les paramètres
    if (typeof value === 'string' && params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match
      })
    }

    return typeof value === 'string' ? value : key
  }

  return { t, language }
}

