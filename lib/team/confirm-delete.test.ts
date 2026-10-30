import { describe, expect, test } from 'vitest'

import { isDeleteConfirmationValid } from './confirm-delete'

describe('isDeleteConfirmationValid — retaper le nom avant de supprimer', () => {
  test('nom exact', () => {
    expect(isDeleteConfirmationValid('Koffi Yao', 'Koffi Yao')).toBe(true)
  })

  test('tolère casse, accents et espaces', () => {
    expect(isDeleteConfirmationValid('  koffi   yao ', 'Koffi Yao')).toBe(true)
    expect(isDeleteConfirmationValid('Jerome', 'Jérôme')).toBe(true)
  })

  test('refuse un nom partiel, vide ou différent', () => {
    expect(isDeleteConfirmationValid('Koffi', 'Koffi Yao')).toBe(false)
    expect(isDeleteConfirmationValid('', 'Koffi Yao')).toBe(false)
    expect(isDeleteConfirmationValid('Jean', 'Koffi Yao')).toBe(false)
    expect(isDeleteConfirmationValid('', '')).toBe(false)
  })
})
