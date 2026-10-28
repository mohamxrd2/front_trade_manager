import { describe, expect, test } from 'vitest'
import { stripDiacritics } from './diacritics-fallback'

describe('stripDiacritics', () => {
  test('remplace les lettres accentuées françaises courantes par leur équivalent ASCII', () => {
    expect(stripDiacritics('Café à côté')).toBe('Cafe a cote')
    expect(stripDiacritics('Déjà reçu')).toBe('Deja recu')
    expect(stripDiacritics('Noël')).toBe('Noel')
  })

  test('gère la ligature œ/æ (pas couverte par la décomposition NFD seule)', () => {
    expect(stripDiacritics('Sœur')).toBe('Soeur')
    expect(stripDiacritics('CŒUR')).toBe('COEUR')
  })

  test('un texte déjà en ASCII pur reste inchangé', () => {
    expect(stripDiacritics('Ticket V-261028-0042')).toBe('Ticket V-261028-0042')
  })

  test('les chiffres et la ponctuation ne sont jamais touchés', () => {
    expect(stripDiacritics('2 × 12 000 FCFA — Reçu : 25 000')).toBe('2 × 12 000 FCFA — Recu : 25 000')
  })
})
