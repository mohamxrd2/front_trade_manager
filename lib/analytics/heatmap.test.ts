import { describe, expect, test } from 'vitest'
import { aggregateByDayPeriod, bestMoments, periodOfHour, referenceDateForDayOfWeek } from './heatmap'
import type { HeatmapCell } from '@/lib/services/analytics'

function cell(dayOfWeek: number, hour: number, revenue: number, salesCount = 1): HeatmapCell {
  return { day_of_week: dayOfWeek, hour, revenue, sales_count: salesCount }
}

describe('periodOfHour', () => {
  test('découpe la journée en 4 tranches de 6h', () => {
    expect(periodOfHour(0)).toBe(0)
    expect(periodOfHour(5)).toBe(0)
    expect(periodOfHour(6)).toBe(1)
    expect(periodOfHour(11)).toBe(1)
    expect(periodOfHour(12)).toBe(2)
    expect(periodOfHour(17)).toBe(2)
    expect(periodOfHour(18)).toBe(3)
    expect(periodOfHour(23)).toBe(3)
  })
})

describe('aggregateByDayPeriod', () => {
  test('somme le CA de toutes les heures de la même tranche', () => {
    const cells = [cell(6, 16, 1000), cell(6, 17, 2000), cell(6, 10, 500)]
    const buckets = aggregateByDayPeriod(cells)
    const afternoon = buckets.find((b) => b.dayOfWeek === 6 && b.period === 2)
    expect(afternoon?.revenue).toBe(3000)
    const morning = buckets.find((b) => b.dayOfWeek === 6 && b.period === 1)
    expect(morning?.revenue).toBe(500)
  })
})

describe('bestMoments', () => {
  test('aucune donnée : null', () => {
    expect(bestMoments([])).toBeNull()
  })

  test('un seul moment avec du CA : second est null', () => {
    const result = bestMoments([cell(6, 16, 1000)])
    expect(result?.first.dayOfWeek).toBe(6)
    expect(result?.second).toBeNull()
  })

  test('les deux meilleurs moments sont sur des jours différents', () => {
    // Samedi après-midi (jour 6) le plus fort, puis samedi SOIR (toujours
    // jour 6, 2e plus fort) puis vendredi soir (jour 5) moins fort que le
    // samedi soir — le second moment doit sauter le samedi soir pour
    // proposer vendredi, pas repartir sur le même jour.
    const cells = [
      cell(6, 16, 5000), // samedi après-midi
      cell(6, 20, 3000), // samedi soir
      cell(5, 20, 2000), // vendredi soir
    ]
    const result = bestMoments(cells)
    expect(result?.first).toEqual({ dayOfWeek: 6, period: 2, revenue: 5000 })
    expect(result?.second).toEqual({ dayOfWeek: 5, period: 3, revenue: 2000 })
  })
})

describe('referenceDateForDayOfWeek', () => {
  test('0 = dimanche, 6 = samedi (jour de semaine ISO day-of-week 0..6)', () => {
    expect(referenceDateForDayOfWeek(0)).toBe('2024-01-07') // dimanche
    expect(referenceDateForDayOfWeek(6)).toBe('2024-01-13') // samedi
  })
})
