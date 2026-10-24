import { describe, expect, test, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import { keys } from '@/lib/query-keys'
import type { Transaction } from '@/lib/services/transactions'
import {
  createDeleteTransactionMutationOptions,
  createRestoreTransactionMutationOptions,
} from './useDeleteTransaction'

vi.mock('@/lib/services/transactions', () => ({
  deleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
}))

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    type: 'sale',
    name: 'Vente de 2 Robe wax',
    quantity: 2,
    amount: 10000,
    date: '2026-10-24T14:32:00.000Z',
    article_id: 'art1',
    ...overrides,
  }
}

/**
 * Teste onMutate/onError directement (pas de rendu React, pas de hook) :
 * ce sont de simples fonctions reçues par useMutation, isolées dans une
 * fabrique exportée exprès pour être testées sans jsdom/@testing-library.
 */
describe('createDeleteTransactionMutationOptions', () => {
  test('onMutate retire optimistiquement la transaction de la liste en cache', async () => {
    const queryClient = new QueryClient()
    const t1 = makeTransaction({ id: 't1' })
    const t2 = makeTransaction({ id: 't2' })
    queryClient.setQueryData(keys.transactions.list(), [t1, t2])

    const options = createDeleteTransactionMutationOptions(queryClient)
    const context = await options.onMutate(t1)

    expect(queryClient.getQueryData(keys.transactions.list())).toEqual([t2])
    expect(context.previous).toEqual([t1, t2])
  })

  test('onError restaure la liste précédente (retour en arrière)', async () => {
    const queryClient = new QueryClient()
    const t1 = makeTransaction({ id: 't1' })
    const t2 = makeTransaction({ id: 't2' })
    queryClient.setQueryData(keys.transactions.list(), [t1, t2])

    const options = createDeleteTransactionMutationOptions(queryClient)
    const context = await options.onMutate(t1)
    expect(queryClient.getQueryData(keys.transactions.list())).toEqual([t2])

    options.onError(new Error('refusé par le serveur'), t1, context)

    expect(queryClient.getQueryData(keys.transactions.list())).toEqual([t1, t2])
  })

  test('onSuccess invalide les totaux, le stock de l\'article concerné et les parts des collaborateurs', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const t1 = makeTransaction({ id: 't1', article_id: 'art1' })

    const options = createDeleteTransactionMutationOptions(queryClient)
    options.onSuccess(undefined, t1)

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        keys.transactions.all,
        keys.userStats.all,
        keys.collaborators.all,
        keys.analytics.all,
        keys.dashboard.all,
        keys.wallet.all,
        keys.products.list(),
        keys.products.detail('art1'),
      ])
    )
  })

  test('onSuccess n\'invalide pas le stock des produits pour une dépense (sans article_id)', () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const expense = makeTransaction({ id: 'e1', type: 'expense', article_id: null, quantity: null })

    const options = createDeleteTransactionMutationOptions(queryClient)
    options.onSuccess(undefined, expense)

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(invalidatedKeys).not.toEqual(expect.arrayContaining([keys.products.list()]))
  })
})

describe('createRestoreTransactionMutationOptions', () => {
  test('onMutate réinsère optimistiquement la transaction en tête de liste', async () => {
    const queryClient = new QueryClient()
    const t2 = makeTransaction({ id: 't2' })
    queryClient.setQueryData(keys.transactions.list(), [t2])
    const t1 = makeTransaction({ id: 't1' })

    const options = createRestoreTransactionMutationOptions(queryClient)
    const context = await options.onMutate(t1)

    expect(queryClient.getQueryData(keys.transactions.list())).toEqual([t1, t2])
    expect(context.previous).toEqual([t2])
  })

  test('onError restaure l\'état précédent si le serveur refuse la restauration', async () => {
    const queryClient = new QueryClient()
    const t2 = makeTransaction({ id: 't2' })
    queryClient.setQueryData(keys.transactions.list(), [t2])
    const t1 = makeTransaction({ id: 't1' })

    const options = createRestoreTransactionMutationOptions(queryClient)
    const context = await options.onMutate(t1)

    options.onError(new Error('fenêtre de restauration dépassée'), t1, context)

    expect(queryClient.getQueryData(keys.transactions.list())).toEqual([t2])
  })
})
