import { describe, expect, test } from 'vitest'
import { computeShares } from './compute-shares'

describe('computeShares', () => {
  test('base 1 000 000, un collaborateur à 25 % → collaborateur 250 000, gérant 750 000', () => {
    const result = computeShares({
      base: 1_000_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 25, isOwner: false },
      ],
    })

    const owner = result.find((r) => r.isOwner)!
    const c1 = result.find((r) => r.id === 'c1')!

    expect(owner.share).toBe(75)
    expect(owner.amount).toBe(750_000)
    expect(c1.share).toBe(25)
    expect(c1.amount).toBe(250_000)
  })

  test('ajout d\'un collaborateur à 10 % → gérant 650 000', () => {
    const result = computeShares({
      base: 1_000_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 25, isOwner: false },
        { id: 'c2', share: 10, isOwner: false },
      ],
    })

    const owner = result.find((r) => r.isOwner)!
    expect(owner.share).toBe(65)
    expect(owner.amount).toBe(650_000)
  })

  test('retrait d\'un collaborateur → la part du gérant remonte', () => {
    const withTwo = computeShares({
      base: 1_000_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 25, isOwner: false },
        { id: 'c2', share: 10, isOwner: false },
      ],
    })
    const afterRemoval = computeShares({
      base: 1_000_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 25, isOwner: false },
      ],
    })

    const ownerBefore = withTwo.find((r) => r.isOwner)!
    const ownerAfter = afterRemoval.find((r) => r.isOwner)!

    expect(ownerBefore.share).toBe(65)
    expect(ownerAfter.share).toBe(75)
    expect(ownerAfter.share).toBeGreaterThan(ownerBefore.share)
  })

  test('3 collaborateurs à 33,33 % sur 100 001 → la somme des montants = 100 001 exactement', () => {
    const result = computeShares({
      base: 100_001,
      collaborators: [
        { id: 'owner', share: 0.01, isOwner: true },
        { id: 'c1', share: 33.33, isOwner: false },
        { id: 'c2', share: 33.33, isOwner: false },
        { id: 'c3', share: 33.33, isOwner: false },
      ],
    })

    const total = result.reduce((sum, r) => sum + r.amount, 0)
    expect(total).toBe(100_001)
  })

  test('base négative → montants négatifs, somme exacte', () => {
    const result = computeShares({
      base: -500_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 20, isOwner: false },
        { id: 'c2', share: 15, isOwner: false },
      ],
    })

    const owner = result.find((r) => r.isOwner)!
    const c1 = result.find((r) => r.id === 'c1')!
    const c2 = result.find((r) => r.id === 'c2')!
    const total = result.reduce((sum, r) => sum + r.amount, 0)

    expect(c1.amount).toBeLessThan(0)
    expect(c2.amount).toBeLessThan(0)
    expect(owner.amount).toBeLessThan(0)
    expect(total).toBe(-500_000)
  })

  test('aucun collaborateur → gérant 100 %, montant = base', () => {
    const result = computeShares({
      base: 42_000,
      collaborators: [{ id: 'owner', share: 0, isOwner: true }],
    })

    expect(result).toHaveLength(1)
    expect(result[0].share).toBe(100)
    expect(result[0].amount).toBe(42_000)
  })

  test('base 0 → tous les montants sont 0', () => {
    const result = computeShares({
      base: 0,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 50, isOwner: false },
      ],
    })

    expect(result.every((r) => r.amount === 0)).toBe(true)
  })

  test('modification d\'une part de 25 % à 30 % → le gérant perd 5 %', () => {
    const before = computeShares({
      base: 1_000_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 25, isOwner: false },
      ],
    })
    const after = computeShares({
      base: 1_000_000,
      collaborators: [
        { id: 'owner', share: 0, isOwner: true },
        { id: 'c1', share: 30, isOwner: false },
      ],
    })

    const ownerBefore = before.find((r) => r.isOwner)!
    const ownerAfter = after.find((r) => r.isOwner)!

    expect(ownerBefore.share).toBe(75)
    expect(ownerAfter.share).toBe(70)
    expect(ownerBefore.share - ownerAfter.share).toBe(5)
    expect(ownerBefore.amount - ownerAfter.amount).toBe(50_000)
  })

  test('sans entrée gérant dans la liste → ne renvoie que les collaborateurs (pas de crash)', () => {
    const result = computeShares({
      base: 1000,
      collaborators: [{ id: 'c1', share: 50, isOwner: false }],
    })

    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(500)
  })
})
