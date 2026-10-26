import { describe, expect, test } from 'vitest'
import { isSearchableQuery, looksLikeAmount, looksLikeDate, splitForHighlight } from './search-query'

describe('looksLikeDate', () => {
  test.each(['24/10/2026', '24/10/26', '24/10', '24-10-2026', '2026-10-24'])('reconnaît "%s"', (q) => {
    expect(looksLikeDate(q)).toBe(true)
  })

  test.each(['robe', '25000', 'octobre 2026', ''])('ne reconnaît pas "%s"', (q) => {
    expect(looksLikeDate(q)).toBe(false)
  })
})

describe('looksLikeAmount', () => {
  test.each(['25000', '25 000', '25.000', '1000'])('reconnaît "%s"', (q) => {
    expect(looksLikeAmount(q)).toBe(true)
  })

  test.each(['robe', '24/10/2026', '12', '5', ''])('ne reconnaît pas "%s"', (q) => {
    expect(looksLikeAmount(q)).toBe(false)
  })
})

describe('isSearchableQuery', () => {
  test('chaîne vide : non', () => {
    expect(isSearchableQuery('')).toBe(false)
    expect(isSearchableQuery('   ')).toBe(false)
  })

  test('1 caractère quelconque : non (pas une date/montant reconnu)', () => {
    expect(isSearchableQuery('a')).toBe(false)
    expect(isSearchableQuery('5')).toBe(false)
  })

  test('2 caractères ou plus : oui', () => {
    expect(isSearchableQuery('ro')).toBe(true)
    expect(isSearchableQuery('robe')).toBe(true)
  })

  test('une date reconnue déclenche la recherche même courte', () => {
    expect(isSearchableQuery('24/10')).toBe(true)
  })

  test('un montant reconnu déclenche la recherche', () => {
    expect(isSearchableQuery('25000')).toBe(true)
  })
})

describe('splitForHighlight', () => {
  test('surligne une occurrence simple, insensible à la casse', () => {
    const segments = splitForHighlight('Robe wax', 'robe')
    expect(segments).toEqual([
      { text: 'Robe', matched: true },
      { text: ' wax', matched: false },
    ])
  })

  test('surligne plusieurs mots de la requête', () => {
    const segments = splitForHighlight('Robe wax Taille M', 'robe M')
    expect(segments.filter((s) => s.matched).map((s) => s.text)).toEqual(['Robe', 'M'])
  })

  test('requête vide : un seul segment non surligné', () => {
    expect(splitForHighlight('Robe wax', '')).toEqual([{ text: 'Robe wax', matched: false }])
  })

  test('aucune occurrence : un seul segment non surligné', () => {
    const segments = splitForHighlight('Robe wax', 'sac')
    expect(segments.every((s) => !s.matched)).toBe(true)
  })

  test('caractères spéciaux dans la requête ne cassent pas la regex', () => {
    expect(() => splitForHighlight('Prix: 25.000 F', '25.000')).not.toThrow()
  })
})
