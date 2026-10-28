import { describe, expect, test } from 'vitest'
import { formatAmountDisplay } from './format-amount'

// Separateur de milliers reel emis par Intl.NumberFormat('fr-FR') : un espace
// fine insecable (U+202F), pas un espace normal - voir lib/i18n/format.test.ts.
// Construit via String.fromCharCode plutot qu'un caractere litteral colle,
// qui se reduit silencieusement a un espace normal U+0020 au moindre
// copier/coller.
const NBSP = String.fromCharCode(0x202f)

describe('formatAmountDisplay', () => {
  test('visible : renvoie le montant formate selon la langue', () => {
    expect(formatAmountDisplay(1_245_000, 'fr', false).text).toBe(`1${NBSP}245${NBSP}000`)
    expect(formatAmountDisplay(1_245_000, 'en', false).text).toBe('1,245,000')
  })

  test('masque : renvoie des points, jamais le montant', () => {
    const { text } = formatAmountDisplay(1_245_000, 'fr', true)
    expect(text).not.toContain('1')
    expect(text).toMatch(/^\u2022+$/)
  })

  test('masque : le nombre de points suit grossierement la longueur du montant reel (jamais sous 6, jamais au-dessus de 10)', () => {
    expect(formatAmountDisplay(0, 'fr', true).text).toHaveLength(6)
    expect(formatAmountDisplay(5, 'fr', true).text).toHaveLength(6)
    expect(formatAmountDisplay(12_450_000, 'fr', true).text.length).toBeGreaterThanOrEqual(6)
    expect(formatAmountDisplay(12_450_000, 'fr', true).text.length).toBeLessThanOrEqual(10)
  })

  test('minWidthCh correspond exactement au texte affiché (visible ou masque), sans rembourrage artificiel', () => {
    const visible = formatAmountDisplay(1_245_000, 'fr', false)
    expect(visible.minWidthCh).toBe(visible.text.length)

    const hidden = formatAmountDisplay(1_245_000, 'fr', true)
    expect(hidden.minWidthCh).toBe(hidden.text.length)
  })

  test('la devise reste collee au montant visible, meme pour un petit nombre (pas de grand espace avant "F")', () => {
    // Avant correctif : minWidthCh etait force a 6 meme en visible, ce qui
    // creait un grand espace reserve entre "0" et la devise suivante.
    expect(formatAmountDisplay(0, 'fr', false).minWidthCh).toBe(1)
    expect(formatAmountDisplay(0, 'fr', false).text).toBe('0')
  })

  test('respecte les options Intl.NumberFormat (ex. maximumFractionDigits)', () => {
    expect(formatAmountDisplay(42.5, 'fr', false, { maximumFractionDigits: 0 }).text).toBe('43')
  })
})
