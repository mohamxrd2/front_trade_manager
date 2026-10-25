'use client'

import { useLanguage } from '../context/LanguageContext'
import { translate } from '../translate'

/**
 * Hook React fin : toute la logique (fusion des fichiers par domaine, repli
 * français, pluriels ICU) vit dans lib/i18n/translate.ts (pur, testable sans
 * React/jsdom) — ce hook ne fait que brancher la langue active du contexte
 * et, en développement uniquement, la pseudo-langue "xx" (voir
 * lib/i18n/current-language.ts) : chaque texte réellement traduit est
 * entouré de ⟦ ⟧, pour repérer d'un coup d'œil tout texte encore en dur.
 */
export function useTranslation() {
  const { language, pseudoMode } = useLanguage()

  const t = (key: string, params?: Record<string, string | number>): string => {
    const resolved = translate(key, language, params)
    if (pseudoMode) return `⟦${resolved}⟧`
    return resolved
  }

  return { t, language }
}
