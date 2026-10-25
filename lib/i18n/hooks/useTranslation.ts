'use client'

import { useLanguage } from '../context/LanguageContext'
import { translate } from '../translate'

/**
 * Hook React fin : toute la logique (fusion des fichiers par domaine, repli
 * français, pluriels ICU) vit dans lib/i18n/translate.ts (pur, testable sans
 * React/jsdom) — ce hook ne fait que brancher la langue active du contexte.
 */
export function useTranslation() {
  const { language } = useLanguage()

  const t = (key: string, params?: Record<string, string | number>): string => translate(key, language, params)

  return { t, language }
}
