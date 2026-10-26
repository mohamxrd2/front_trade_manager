import { describe, expect, test } from 'vitest'
import type { Transaction } from '@/lib/services/transactions'
import { isDeletableFromList } from './can-delete'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return { id: 't1', type: 'sale', name: 'Vente', amount: 1000, date: '2026-10-24', ...overrides }
}

describe('isDeletableFromList', () => {
  test('une vente sans facture est supprimable', () => {
    expect(isDeletableFromList(makeTx({ type: 'sale', invoice_id: null }))).toBe(true)
  })

  test('une vente liée à une facture payée n\'est pas supprimable', () => {
    expect(isDeletableFromList(makeTx({ type: 'sale', invoice_id: 'inv1' }), 'paid')).toBe(false)
  })

  test('une vente liée à une facture non payée reste supprimable', () => {
    expect(isDeletableFromList(makeTx({ type: 'sale', invoice_id: 'inv1' }), 'draft')).toBe(true)
  })

  test('une dépense est toujours supprimable', () => {
    expect(isDeletableFromList(makeTx({ type: 'expense' }))).toBe(true)
  })

  test('un apport est toujours supprimable (mêmes règles qu\'une dépense)', () => {
    expect(isDeletableFromList(makeTx({ type: 'apport' }))).toBe(true)
  })

  test('un retrait est toujours supprimable', () => {
    expect(isDeletableFromList(makeTx({ type: 'retrait' }))).toBe(true)
  })
})
