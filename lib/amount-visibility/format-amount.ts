import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

/**
 * Décision de rendu partagée par <Amount> (components/waelly/amount.tsx) ET
 * par les formateurs internes de components/waelly/area-trend-chart.tsx
 * (axe Y, bulle de valeur, infobulle) — pure, sans React, pour rester
 * testable sans jsdom (même convention que lib/i18n/translate.ts).
 *
 * `minWidthCh` est dérivé du texte RÉELLEMENT affiché (visible ou masqué) —
 * la devise reste collée au montant visible (ex. « 0 F », jamais
 * « 0␠␠␠␠␠␠F »). Un ancien réglage réservait une largeur fixe d'AU MOINS 6
 * caractères même en visible (pour que le masquage, qui a lui un plancher de
 * 6 points par confidentialité, n'entraîne aucun saut de mise en page) —
 * corrigé ici : la confidentialité du masquage prime sur la stabilité au
 * pixel près lors du bascule, qui n'est qu'un micro-décalage sur de très
 * petits montants.
 */
const MIN_DOTS = 6
const MAX_DOTS = 10

export interface FormattedAmount {
  /** Texte à afficher : le montant formaté, ou une suite de points de longueur proche. */
  text: string
  /** Largeur minimale en `ch`, dérivée du texte réellement affiché (visible ou masqué). */
  minWidthCh: number
}

export function formatAmountDisplay(
  value: number,
  language: AppLanguage,
  hidden: boolean,
  options?: Intl.NumberFormatOptions
): FormattedAmount {
  const formatted = formatNumber(value, language, options)

  if (!hidden) {
    return { text: formatted, minWidthCh: formatted.length }
  }

  // Plancher de confidentialité : jamais moins de 6 points, pour ne pas
  // laisser deviner qu'un montant est petit par la longueur du masque.
  const dotCount = Math.min(MAX_DOTS, Math.max(MIN_DOTS, formatted.length))
  return { text: '•'.repeat(dotCount), minWidthCh: dotCount }
}
