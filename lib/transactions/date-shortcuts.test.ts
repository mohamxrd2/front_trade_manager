import dayjs from 'dayjs'
import { describe, expect, test } from 'vitest'
import { computeDateShortcutRange } from './date-shortcuts'

// Référence fixe (pas dayjs() sans argument) pour des tests déterministes.
const REFERENCE = dayjs('2026-10-24')

describe('computeDateShortcutRange', () => {
  test('today : jour courant, from = to', () => {
    expect(computeDateShortcutRange('today', REFERENCE)).toEqual({ from: '2026-10-24', to: '2026-10-24' })
  })

  test('yesterday : la veille, from = to', () => {
    expect(computeDateShortcutRange('yesterday', REFERENCE)).toEqual({ from: '2026-10-23', to: '2026-10-23' })
  })

  test('last7days : 7 jours glissants, bornes incluses', () => {
    expect(computeDateShortcutRange('last7days', REFERENCE)).toEqual({ from: '2026-10-18', to: '2026-10-24' })
  })

  test('thisMonth : du 1er au dernier jour du mois en cours', () => {
    expect(computeDateShortcutRange('thisMonth', REFERENCE)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  test('lastMonth : le mois précédent entier', () => {
    expect(computeDateShortcutRange('lastMonth', REFERENCE)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
})
