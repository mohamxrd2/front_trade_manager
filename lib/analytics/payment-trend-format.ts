import dayjs from 'dayjs'

import type { SummaryPeriod } from '@/lib/services/analytics'
import { formatAmountDisplay } from '@/lib/amount-visibility/format-amount'
import type { AppLanguage } from '@/lib/i18n/current-language'

export const HIDDEN_AXIS_LABEL = '•••'

/** Étiquette d'un point de la série "Évolution par moyen de paiement" — dépend de la granularité du bucket (jour/mois/tranche de 2h), voir AnalyticsSummaryService côté backend. */
export function bucketLabel(bucket: string, period: SummaryPeriod, language: AppLanguage): string {
  if (period === 'today') return `${bucket}h`
  if (period === '12m') return dayjs(`${bucket}-01`).locale(language).format('MMM')
  return dayjs(bucket).locale(language).format('DD/MM')
}

/**
 * Valeur d'un tick d'axe Y — masquée ("•••") quand l'œil est fermé, jamais
 * la vraie valeur. La FORME du graphe (hauteur relative des barres) reste
 * inchangée : seul ce texte d'étiquette est remplacé, pas les données.
 */
export function formatTickValue(value: number, language: AppLanguage, hidden: boolean): string {
  if (hidden) return HIDDEN_AXIS_LABEL
  return formatAmountDisplay(value, language, false, { maximumFractionDigits: 0 }).text
}

/** Valeur affichée dans l'infobulle pour un moyen de paiement — "•••" masquée, sinon le montant formaté + "F". */
export function formatTooltipValue(value: number, language: AppLanguage, hidden: boolean): string {
  if (hidden) return HIDDEN_AXIS_LABEL
  return `${formatAmountDisplay(value, language, false, { maximumFractionDigits: 0 }).text} F`
}
