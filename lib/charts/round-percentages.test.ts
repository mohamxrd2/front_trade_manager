import { describe, expect, test } from 'vitest'
import { roundPercentagesTo100 } from './round-percentages'

describe('roundPercentagesTo100', () => {
  test('somme toujours exactement 100', () => {
    // 3 parts égales -> 33.33/33.33/33.33, arrondi naïf donnerait 33+33+33=99.
    const result = roundPercentagesTo100([1, 1, 1])
    expect(result.reduce((sum, v) => sum + v, 0)).toBe(100)
  })

  test('le reste est ajouté à la plus grande part', () => {
    const result = roundPercentagesTo100([1, 1, 1])
    expect(Math.max(...result)).toBe(34)
  })

  test('cas simple sans arrondi nécessaire', () => {
    expect(roundPercentagesTo100([50, 50])).toEqual([50, 50])
  })

  test('toutes les valeurs à zéro renvoie des zéros (pas de division par zéro)', () => {
    expect(roundPercentagesTo100([0, 0, 0])).toEqual([0, 0, 0])
  })

  test('liste vide renvoie une liste vide', () => {
    expect(roundPercentagesTo100([])).toEqual([])
  })

  test('une seule valeur renvoie 100', () => {
    expect(roundPercentagesTo100([42])).toEqual([100])
  })
})
