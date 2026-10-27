import { describe, expect, test } from 'vitest'
import type { Transaction } from '@/lib/services/transactions'
import { groupTransactionsByOperation, operationGroupTitle, singleLineTitle } from './group-by-operation'

const t = (key: string, params?: Record<string, string | number>): string => {
  if (key === 'wallet.list.articlesCount') return `${params?.count} articles`
  if (key === 'transactions.deposit') return 'Apport'
  if (key === 'transactions.withdrawal') return 'Retrait'
  if (key === 'transactions.operation') return 'Opération'
  return key
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'sale',
    name: 'Robe wax',
    amount: 24000,
    date: '2026-10-26T14:32:00',
    operation_id: 'op-1',
    operation_code: 'V-261026-0042',
    ...overrides,
  }
}

describe('groupTransactionsByOperation', () => {
  test('des lignes partageant le même operation_id sont fusionnées en un seul groupe', () => {
    const lines = [
      makeTx({ id: 't1', article_name: 'Robe wax', quantity: 2, amount: 24000 }),
      makeTx({ id: 't2', article_name: 'Sac raphia', quantity: 1, amount: 18000 }),
    ]
    const groups = groupTransactionsByOperation(lines)
    expect(groups).toHaveLength(1)
    expect(groups[0].lines).toHaveLength(2)
    expect(groups[0].amount).toBe(24000 + 18000)
    expect(groups[0].operationCode).toBe('V-261026-0042')
  })

  test('des operation_id différents restent des groupes séparés', () => {
    const lines = [
      makeTx({ id: 't1', operation_id: 'op-1' }),
      makeTx({ id: 't2', operation_id: 'op-2' }),
    ]
    expect(groupTransactionsByOperation(lines)).toHaveLength(2)
  })

  test('fusionne même si les lignes ne sont pas adjacentes dans le tableau', () => {
    const lines = [
      makeTx({ id: 't1', operation_id: 'op-1' }),
      makeTx({ id: 't2', operation_id: 'op-2' }),
      makeTx({ id: 't3', operation_id: 'op-1' }),
    ]
    const groups = groupTransactionsByOperation(lines)
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.operationId === 'op-1')?.lines).toHaveLength(2)
  })

  test('une transaction sans operation_id devient son propre groupe (repli, ne plante jamais)', () => {
    const lines = [makeTx({ id: 't1', operation_id: null })]
    const groups = groupTransactionsByOperation(lines)
    expect(groups).toHaveLength(1)
    expect(groups[0].operationId).toBe('t1')
  })
})

describe('operationGroupTitle', () => {
  test('une seule ligne : même libellé que singleLineTitle (article · variation ×N)', () => {
    const line = makeTx({ article_name: 'Robe wax', variation_name: 'Taille M', quantity: 2 })
    const groups = groupTransactionsByOperation([line])
    expect(operationGroupTitle(groups[0], t)).toBe(singleLineTitle(line, t))
    expect(operationGroupTitle(groups[0], t)).toBe('Robe wax · Taille M ×2')
  })

  test('2 lignes : "Article A ×2, Article B"', () => {
    const lines = [
      makeTx({ id: 't1', article_name: 'Robe wax', quantity: 2 }),
      makeTx({ id: 't2', article_name: 'Sac raphia', quantity: 1 }),
    ]
    const groups = groupTransactionsByOperation(lines)
    expect(operationGroupTitle(groups[0], t)).toBe('Robe wax ×2, Sac raphia')
  })

  test('plus de 2 lignes : "N articles"', () => {
    const lines = [
      makeTx({ id: 't1', article_name: 'A' }),
      makeTx({ id: 't2', article_name: 'B' }),
      makeTx({ id: 't3', article_name: 'C' }),
    ]
    const groups = groupTransactionsByOperation(lines)
    expect(operationGroupTitle(groups[0], t)).toBe('3 articles')
  })

  test('une opération apport/retrait garde son libellé traduit habituel', () => {
    const groups = groupTransactionsByOperation([makeTx({ type: 'apport', name: 'Apport de fonds' })])
    expect(operationGroupTitle(groups[0], t)).toBe('Apport')
  })
})
