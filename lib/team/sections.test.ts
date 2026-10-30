import { describe, expect, test } from 'vitest'

import { splitTeamSections } from './sections'

const person = (id: string, over: Partial<{ is_owner: boolean; is_partner: boolean; role: string | null }>) => ({
  id,
  is_owner: false,
  is_partner: false,
  role: null as string | null,
  ...over,
})

describe('splitTeamSections — direction en haut, équipe en dessous', () => {
  test('propriétaire, gérant et associés en haut ; caissier, stock et comptable en dessous', () => {
    const members = [
      person('owner', { is_owner: true, role: 'owner' }),
      person('cashier', { role: 'cashier' }),
      person('partner', { is_partner: true }),
      person('manager', { role: 'manager' }),
      person('stock', { role: 'stock_manager' }),
      person('cashier-partner', { is_partner: true, role: 'cashier' }),
      person('accountant', { role: 'accountant' }),
    ]
    const { leaders, others } = splitTeamSections(members)
    expect(leaders.map((m) => m.id)).toEqual(['owner', 'partner', 'manager', 'cashier-partner'])
    expect(others.map((m) => m.id)).toEqual(['cashier', 'stock', 'accountant'])
  })

  test('liste vide', () => {
    expect(splitTeamSections([])).toEqual({ leaders: [], others: [] })
  })
})
