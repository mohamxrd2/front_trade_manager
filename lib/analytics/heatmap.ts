import type { HeatmapCell } from '@/lib/services/analytics'

/** 0 = nuit (0h-6h), 1 = matin (6h-12h), 2 = après-midi (12h-18h), 3 = soir (18h-24h). */
export type DayPeriod = 0 | 1 | 2 | 3

export const PERIOD_KEYS: Record<DayPeriod, string> = {
  0: 'analytics.page.heatmap.periodNight',
  1: 'analytics.page.heatmap.periodMorning',
  2: 'analytics.page.heatmap.periodAfternoon',
  3: 'analytics.page.heatmap.periodEvening',
}

export function periodOfHour(hour: number): DayPeriod {
  return Math.floor(hour / 6) as DayPeriod
}

export interface DayPeriodBucket {
  dayOfWeek: number
  period: DayPeriod
  revenue: number
}

/** Agrège les cellules du heatmap par (jour × période de la journée) — base du calcul des "meilleurs moments". */
export function aggregateByDayPeriod(cells: HeatmapCell[]): DayPeriodBucket[] {
  const buckets = new Map<string, DayPeriodBucket>()
  for (const cell of cells) {
    const period = periodOfHour(cell.hour)
    const key = `${cell.day_of_week}-${period}`
    const existing = buckets.get(key)
    if (existing) {
      existing.revenue += cell.revenue
    } else {
      buckets.set(key, { dayOfWeek: cell.day_of_week, period, revenue: cell.revenue })
    }
  }
  return Array.from(buckets.values())
}

export interface BestMoments {
  first: DayPeriodBucket
  /** null si un seul jour a du chiffre d'affaires sur la période (pas de second moment distinct à proposer). */
  second: DayPeriodBucket | null
}

/**
 * Les deux meilleurs moments (jour × période), sur des jours DIFFÉRENTS —
 * proposer deux fois le même jour ("samedi matin et samedi après-midi")
 * serait moins utile qu'une vraie répartition sur la semaine.
 */
export function bestMoments(cells: HeatmapCell[]): BestMoments | null {
  const sorted = aggregateByDayPeriod(cells)
    .filter((b) => b.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)

  if (sorted.length === 0) return null

  const first = sorted[0]
  const second = sorted.find((b) => b.dayOfWeek !== first.dayOfWeek) ?? null

  return { first, second }
}

/** Référence ISO d'un jour de semaine donné (0=dimanche…6=samedi) sur une semaine fixe arbitraire — pour en tirer le NOM du jour via formatDate(..., 'dddd'), peu importe l'année réelle. */
export function referenceDateForDayOfWeek(dayOfWeek: number): string {
  // 2024-01-07 est un dimanche.
  const base = new Date(Date.UTC(2024, 0, 7))
  base.setUTCDate(base.getUTCDate() + dayOfWeek)
  return base.toISOString().slice(0, 10)
}
