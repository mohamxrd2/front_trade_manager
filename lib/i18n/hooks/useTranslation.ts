'use client'

import { useCallback, useMemo } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { translate } from '../translate'

/**
 * Hook React fin : toute la logique (fusion des fichiers par domaine, repli
 * français, pluriels ICU) vit dans lib/i18n/translate.ts (pur, testable sans
 * React/jsdom) — ce hook ne fait que brancher la langue active du contexte
 * et, en développement uniquement, la pseudo-langue "xx" (voir
 * lib/i18n/current-language.ts) : chaque texte réellement traduit est
 * entouré de ⟦ ⟧, pour repérer d'un coup d'œil tout texte encore en dur.
 *
 * `t` est mémoïsé (useCallback) sur [language, pseudoMode] : de nombreux
 * écrans le mettent dans un tableau de dépendances de useCallback/useEffect
 * (ex. `fetchClients` dépendant de `[..., t]`) — une identité qui change à
 * CHAQUE rendu y déclenchait un re-fetch à chaque rendu, donc une boucle de
 * rendu infinie (symptôme observé : liste qui "tremble"/clignote en boucle).
 */
export function useTranslation() {
  const { language, pseudoMode } = useLanguage()

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const resolved = translate(key, language, params)
      if (pseudoMode) return `⟦${resolved}⟧`
      return resolved
    },
    [language, pseudoMode]
  )

  return useMemo(() => ({ t, language }), [t, language])
}
