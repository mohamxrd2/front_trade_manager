import { describe, expect, test } from 'vitest'
import { HIDDEN_AXIS_LABEL, bucketLabel, formatTickValue, formatTooltipValue } from './payment-trend-format'

describe('bucketLabel', () => {
  test("période 'today' : heure brute suffixée de 'h'", () => {
    expect(bucketLabel('14', 'today', 'fr')).toBe('14h')
  })

  test("période '12m' : mois abrégé localisé", () => {
    expect(bucketLabel('2026-03', '12m', 'fr')).toBe('mars')
    expect(bucketLabel('2026-03', '12m', 'en')).toBe('Mar')
  })

  test("périodes '7d'/'30d' : jour/mois", () => {
    expect(bucketLabel('2026-10-24', '7d', 'fr')).toBe('24/10')
    expect(bucketLabel('2026-10-24', '30d', 'fr')).toBe('24/10')
  })
})

describe('formatTickValue', () => {
  test('masqué : renvoie "•••", jamais la valeur', () => {
    const result = formatTickValue(125000, 'fr', true)
    expect(result).toBe(HIDDEN_AXIS_LABEL)
    expect(result).not.toContain('1')
  })

  test('visible : renvoie le montant formaté selon la langue', () => {
    expect(formatTickValue(1245000, 'en', false)).toBe('1,245,000')
  })
})

describe('formatTooltipValue', () => {
  test('masqué : "•••", pas de suffixe "F"', () => {
    expect(formatTooltipValue(5000, 'fr', true)).toBe(HIDDEN_AXIS_LABEL)
  })

  test('visible : montant formaté + "F"', () => {
    expect(formatTooltipValue(5000, 'en', false)).toBe('5,000 F')
  })
})
