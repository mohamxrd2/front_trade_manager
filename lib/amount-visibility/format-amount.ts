import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

/**
 * Décision de rendu partagée par <Amount> (components/waelly/amount.tsx) ET
 * par les formateurs internes de components/waelly/area-trend-chart.tsx
 * (axe Y, bulle de valeur, infobulle) — pure, sans React, pour rester
 * testable sans jsdom (même convention que lib/i18n/translate.ts).
 *
 * `minWidthCh` est TOUJOURS dérivé du montant réellement formaté (jamais du
 * texte actuellement affiché) : la largeur réservée ne change donc pas
 * quand on bascule masqué/visible, ce qui évite un saut de mise en page.
 */
const MIN_DOTS = 6
const MAX_DOTS = 10

export interface FormattedAmount {
  /** Texte à afficher : le montant formaté, ou une suite de points de longueur proche. */
  text: string
  /** Largeur minimale en `ch`, dérivée du montant réel — stable, que le montant soit affiché ou masqué. */
  minWidthCh: number
}

export function formatAmountDisplay(
  value: number,
  language: AppLanguage,
  hidden: boolean,
  options?: Intl.NumberFormatOptions
): FormattedAmount {
  const formatted = formatNumber(value, language, options)
  const minWidthCh = Math.max(formatted.length, MIN_DOTS)

  if (!hidden) {
    return { text: formatted, minWidthCh }
  }

  const dotCount = Math.min(MAX_DOTS, Math.max(MIN_DOTS, formatted.length))
  return { text: '•'.repeat(dotCount), minWidthCh }
}
