import { describe, expect, test } from 'vitest'

import { requiredPermissionsFor } from './route-permissions'

describe('requiredPermissionsFor', () => {
  test('pages réservées', () => {
    expect(requiredPermissionsFor('/wallet')).toEqual(['wallet.view_balance'])
    expect(requiredPermissionsFor('/analytics')).toEqual(['analytics.view'])
    expect(requiredPermissionsFor('/team')).toEqual(['team.manage'])
    expect(requiredPermissionsFor('/products/abc')).toEqual(['stock.view'])
  })

  test('la règle la plus spécifique gagne : une vente reste possible sans accès au portefeuille', () => {
    expect(requiredPermissionsFor('/wallet/new')).toContain('sales.create')
    expect(requiredPermissionsFor('/products/new')).toEqual(['stock.edit'])
  })

  test('« Mes ventes » : ses ventes ou toutes', () => {
    expect(requiredPermissionsFor('/my-sales')).toEqual(['sales.view_own', 'sales.view_all'])
  })

  test('pages ouvertes à tout membre connecté', () => {
    for (const path of ['/dashboard', '/notifications', '/settings', '/account']) {
      expect(requiredPermissionsFor(path)).toBeNull()
    }
  })

  test('un préfixe ne déborde pas sur une autre route (/walletx)', () => {
    expect(requiredPermissionsFor('/walletx')).toBeNull()
  })
})
