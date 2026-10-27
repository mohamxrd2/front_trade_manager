import { describe, expect, test } from 'vitest'
import { suggestCashAmounts, computeChange } from './cash-amounts'

describe('suggestCashAmounts', () => {
  test('18 500 F → 20 000, 25 000, 50 000 (exemple du cahier des charges)', () => {
    expect(suggestCashAmounts(18500)).toEqual([20000, 25000, 50000])
  })

  test('2 300 F → premiers paliers ronds au-dessus', () => {
    expect(suggestCashAmounts(2300)).toEqual([5000, 10000, 15000])
  })

  test('47 000 F → paliers de 50 000 au-delà de 25 000', () => {
    expect(suggestCashAmounts(47000)).toEqual([50000, 100000, 200000])
  })

  test('chaque montant proposé est strictement supérieur au total, et croissant', () => {
    for (const total of [0, 1, 999, 2300, 18500, 24999, 25000, 47000, 99999]) {
      const amounts = suggestCashAmounts(total)
      for (const amount of amounts) expect(amount).toBeGreaterThan(total)
      for (let i = 1; i < amounts.length; i++) expect(amounts[i]).toBeGreaterThan(amounts[i - 1])
    }
  })

  test('un total négatif ou non fini ne renvoie aucune suggestion', () => {
    expect(suggestCashAmounts(-1)).toEqual([])
    expect(suggestCashAmounts(NaN)).toEqual([])
  })
})

describe('computeChange', () => {
  test('aucun billet sélectionné (null) → monnaie = 0', () => {
    expect(computeChange(null, 18500)).toBe(0)
  })

  test('20 000 reçus pour 18 500 → monnaie à rendre 1 500', () => {
    expect(computeChange(20000, 18500)).toBe(1500)
  })

  test('montant reçu égal au total → monnaie = 0', () => {
    expect(computeChange(18500, 18500)).toBe(0)
  })

  test('ne renvoie jamais une monnaie négative', () => {
    expect(computeChange(1000, 18500)).toBe(0)
  })
})
