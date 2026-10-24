import { describe, expect, test } from 'vitest'
import type { Transaction } from '@/lib/services/transactions'
import { describeDeletionConsequence, formatTransactionSummary } from './transaction-summary'

function makeSale(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    type: 'sale',
    name: 'Vente de 2 Robe wax Taille M',
    quantity: 2,
    amount: 25000,
    date: '2026-10-24T14:32:00',
    article_name: 'Robe wax',
    variation_name: 'Taille M',
    ...overrides,
  }
}

describe('formatTransactionSummary', () => {
  test('vente avec variation et quantité : "Article · Variation ×N — montant, le date"', () => {
    expect(formatTransactionSummary(makeSale())).toBe('Robe wax · Taille M ×2 — 25 000 F, le 24/10 à 14:32')
  })

  test('vente sans variation ni quantité > 1 : pas de "×N"', () => {
    const t = makeSale({ variation_name: null, quantity: 1, amount: 5000 })
    expect(formatTransactionSummary(t)).toBe('Robe wax — 5 000 F, le 24/10 à 14:32')
  })

  test('dépense : utilise le nom de la transaction', () => {
    const expense: Transaction = {
      id: 'e1',
      type: 'expense',
      name: 'Loyer',
      amount: 30000,
      date: '2026-10-24T09:00:00',
    }
    expect(formatTransactionSummary(expense)).toBe('Loyer — 30 000 F, le 24/10 à 09:00')
  })
})

describe('describeDeletionConsequence', () => {
  test('dépense : "Le solde augmentera de X."', () => {
    const expense: Transaction = { id: 'e1', type: 'expense', name: 'Loyer', amount: 30000, date: '2026-10-24' }
    expect(describeDeletionConsequence(expense, null)).toBe('Le solde augmentera de 30 000 F.')
  })

  test('vente avec stock résolu : "Le stock de X reviendra à N."', () => {
    expect(describeDeletionConsequence(makeSale(), 18)).toBe('Le stock de Taille M reviendra à 18.')
  })

  test('vente sans variation : utilise le nom de l\'article', () => {
    const t = makeSale({ variation_name: null })
    expect(describeDeletionConsequence(t, 92)).toBe('Le stock de Robe wax reviendra à 92.')
  })

  test('stock non résolu (article introuvable) : formulation générique', () => {
    expect(describeDeletionConsequence(makeSale(), null)).toBe('Le stock de Taille M sera mis à jour.')
  })
})
