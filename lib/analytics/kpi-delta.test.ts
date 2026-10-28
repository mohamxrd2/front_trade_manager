import { describe, expect, test } from 'vitest'
import { computeKpiDelta } from './kpi-delta'

const fmt = (n: number) => n.toFixed(1)
const labels = { flat: '—', new: 'Nouveau' }

describe('computeKpiDelta', () => {
  test('jamais de flèche dans le texte (évite la double flèche avec <KpiCard>)', () => {
    const result = computeKpiDelta(150, 100, 50, true, fmt, labels)
    expect(result.text).not.toMatch(/[↑↓]/)
    expect(result.text).toBe('50.0 %')
  })

  test('hausse, bon quand ça augmente (ex. CA) : vert, flèche montante', () => {
    const result = computeKpiDelta(150, 100, 50, true, fmt, labels)
    expect(result.trend).toBe('up')
    expect(result.positive).toBe(true)
    expect(result.showArrow).toBe(true)
  })

  test('baisse, bon quand ça augmente (ex. CA) : rouge, flèche descendante', () => {
    const result = computeKpiDelta(80, 100, -20, true, fmt, labels)
    expect(result.trend).toBe('down')
    expect(result.positive).toBe(false)
  })

  test('baisse des DÉPENSES (mauvais quand ça augmente) : une baisse est une BONNE nouvelle, vert', () => {
    const result = computeKpiDelta(80, 100, -20, false, fmt, labels)
    expect(result.trend).toBe('down')
    expect(result.positive).toBe(true)
  })

  test('hausse des DÉPENSES : rouge', () => {
    const result = computeKpiDelta(120, 100, 20, false, fmt, labels)
    expect(result.positive).toBe(false)
  })

  test('variation exactement nulle : pas de flèche, texte "flat"', () => {
    const result = computeKpiDelta(100, 100, 0, true, fmt, labels)
    expect(result.showArrow).toBe(false)
    expect(result.text).toBe('—')
  })

  test('période précédente vide ET valeur courante nulle : "flat", pas de flèche', () => {
    const result = computeKpiDelta(0, 0, 0, true, fmt, labels)
    expect(result.showArrow).toBe(false)
    expect(result.text).toBe('—')
  })

  test('période précédente vide mais valeur courante positive : "Nouveau", pas de flèche verte trompeuse', () => {
    const result = computeKpiDelta(5000, 0, 100, true, fmt, labels)
    expect(result.showArrow).toBe(false)
    expect(result.text).toBe('Nouveau')
    expect(result.positive).toBe(true)
  })

  test('suffixe optionnel ajouté après le pourcentage', () => {
    const result = computeKpiDelta(150, 100, 50, true, fmt, labels, 'vs sem. préc.')
    expect(result.text).toBe('50.0 % vs sem. préc.')
  })
})
