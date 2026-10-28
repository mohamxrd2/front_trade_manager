import { describe, expect, test } from 'vitest'
import { toSummaryPeriod } from './analytics'

describe('toSummaryPeriod', () => {
  test('mappe les périodes du sélecteur existant vers l\'enum du résumé', () => {
    expect(toSummaryPeriod('today')).toBe('today')
    expect(toSummaryPeriod('7')).toBe('7d')
    expect(toSummaryPeriod('30')).toBe('30d')
    expect(toSummaryPeriod('365')).toBe('12m')
  })

  test('90 jours et plage personnalisée ont désormais une correspondance exacte (plus d\'approximation)', () => {
    expect(toSummaryPeriod('90')).toBe('90d')
    expect(toSummaryPeriod('custom')).toBe('custom')
  })

  test('une valeur inconnue retombe sur 30d plutôt que de planter', () => {
    expect(toSummaryPeriod('n\'importe quoi')).toBe('30d')
  })
})
