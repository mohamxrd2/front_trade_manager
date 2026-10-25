import { describe, expect, test } from 'vitest'
import { formatMoney, formatNumber, formatDate, formatDateTime, formatRelative } from './format'

describe('formatNumber', () => {
  test('français : espace fine insécable comme séparateur de milliers', () => {
    expect(formatNumber(1_245_000, 'fr')).toBe('1 245 000')
  })

  test('anglais : virgule comme séparateur de milliers', () => {
    expect(formatNumber(1_245_000, 'en')).toBe('1,245,000')
  })
})

describe('formatMoney', () => {
  test('FCFA : suffixe identique en fr et en, seuls les séparateurs changent', () => {
    expect(formatMoney(1_245_000, 'FCFA', 'fr')).toBe('1 245 000 FCFA')
    expect(formatMoney(1_245_000, 'FCFA', 'en')).toBe('1,245,000 FCFA')
  })

  test('EUR : suffixe "€", indépendant de la langue', () => {
    expect(formatMoney(5000, 'EUR', 'fr')).toBe('5 000 €')
    expect(formatMoney(5000, 'EUR', 'en')).toBe('5,000 €')
  })

  test('USD : préfixe "$", indépendant de la langue', () => {
    expect(formatMoney(5000, 'USD', 'fr')).toBe('$5 000')
    expect(formatMoney(5000, 'USD', 'en')).toBe('$5,000')
  })

  test('devise non reconnue : repli sur FCFA', () => {
    expect(formatMoney(1000, 'XYZ', 'en')).toBe('1,000 FCFA')
  })
})

describe('formatDate', () => {
  test('français : mois abrégé en minuscules avec point', () => {
    expect(formatDate('2026-10-24', 'fr', 'D MMM YYYY')).toBe('24 oct. 2026')
  })

  test('anglais : mois abrégé capitalisé sans point', () => {
    expect(formatDate('2026-10-24', 'en', 'D MMM YYYY')).toBe('24 Oct 2026')
  })
})

describe('formatDateTime', () => {
  test('français : 24h', () => {
    expect(formatDateTime('2026-10-24T14:32:00', 'fr')).toBe('24 oct. 2026 · 14:32')
  })

  test('anglais : 12h AM/PM', () => {
    expect(formatDateTime('2026-10-24T14:32:00', 'en')).toBe('Oct 24, 2026 · 2:32 PM')
  })
})

describe('formatRelative', () => {
  const now = new Date('2026-10-24T14:32:00')

  test('français : "il y a 12 minutes"', () => {
    const twelveMinAgo = new Date(now.getTime() - 12 * 60 * 1000)
    expect(formatRelative(twelveMinAgo, 'fr', now)).toBe('il y a 12 minutes')
  })

  test('anglais : "12 minutes ago"', () => {
    const twelveMinAgo = new Date(now.getTime() - 12 * 60 * 1000)
    expect(formatRelative(twelveMinAgo, 'en', now)).toBe('12 minutes ago')
  })

  test('futur proche : "dans 5 minutes" / "in 5 minutes"', () => {
    const inFiveMin = new Date(now.getTime() + 5 * 60 * 1000)
    expect(formatRelative(inFiveMin, 'fr', now)).toBe('dans 5 minutes')
    expect(formatRelative(inFiveMin, 'en', now)).toBe('in 5 minutes')
  })
})
