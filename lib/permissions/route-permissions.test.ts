import { describe, expect, test } from 'vitest'

import type { User } from '@/lib/auth'
import { getTabs } from '@/lib/tabs'
import { ACCOUNT_ITEMS, ACTIVITY_ITEMS } from '@/components/waelly/glass-sidebar'
import { isRouteAllowed, routeRuleFor } from './route-permissions'

const ROLES: Record<string, string[]> = {
  manager: [
    'sales.create', 'sales.view_own', 'sales.view_all', 'sales.delete_own_recent', 'sales.delete_any', 'expenses.create',
    'expenses.view', 'deposits.manage', 'wallet.view_balance', 'analytics.view', 'dashboard.full', 'stock.view',
    'stock.edit', 'stock.restock', 'invoices.view', 'invoices.manage', 'clients.view', 'clients.manage', 'partners.view',
    'exports.download',
  ],
  cashier: ['sales.create', 'sales.view_own', 'stock.view', 'clients.view', 'expenses.create'],
  stock_manager: ['stock.view', 'stock.edit', 'stock.restock'],
  accountant: ['wallet.view_balance', 'analytics.view', 'expenses.view', 'invoices.view', 'sales.view_all', 'exports.download'],
}

const canFor = (perms: string[]) => (p: string) => perms.includes(p)

describe('routeRuleFor / isRouteAllowed', () => {
  test('pages réservées', () => {
    expect(isRouteAllowed('/analytics', canFor(ROLES.cashier))).toBe(false)
    expect(isRouteAllowed('/team', canFor(ROLES.manager))).toBe(false)
    expect(isRouteAllowed('/products/abc', canFor(ROLES.stock_manager))).toBe(true)
  })

  test('la règle la plus spécifique gagne : une vente reste possible sans accès au portefeuille', () => {
    expect(isRouteAllowed('/wallet/new?type=sale', canFor(['sales.create']))).toBe(true)
    expect(isRouteAllowed('/products/new', canFor(['stock.view']))).toBe(false)
  })

  test('/wallet : portefeuille du gérant ou « Mes opérations » du caissier', () => {
    expect(isRouteAllowed('/wallet', canFor(ROLES.cashier))).toBe(true)
    expect(isRouteAllowed('/wallet', canFor(ROLES.stock_manager))).toBe(false)
  })

  test('/clients exige clients.view ET invoices.view (ni le caissier ni le comptable)', () => {
    expect(isRouteAllowed('/clients', canFor(ROLES.cashier))).toBe(false)
    expect(isRouteAllowed('/clients', canFor(ROLES.accountant))).toBe(false)
    expect(isRouteAllowed('/clients/42', canFor(ROLES.manager))).toBe(true)
  })

  test('pages ouvertes à tout membre connecté', () => {
    for (const path of ['/notifications', '/settings', '/account']) {
      expect(routeRuleFor(path)).toBeNull()
    }
  })

  test('/dashboard : pour qui vend ou voit le solde — pas pour le gestionnaire de stock', () => {
    expect(isRouteAllowed('/dashboard', canFor(ROLES.stock_manager))).toBe(false)
    expect(isRouteAllowed('/dashboard', canFor(ROLES.cashier))).toBe(true)
    expect(isRouteAllowed('/dashboard', canFor(ROLES.accountant))).toBe(true)
    expect(isRouteAllowed('/dashboard', canFor(ROLES.manager))).toBe(true)
  })

  test('un préfixe ne déborde pas sur une autre route (/walletx)', () => {
    expect(routeRuleFor('/walletx')).toBeNull()
  })
})

describe('navigation : aucune page affichée n’est refusée, pour chaque rôle', () => {
  test.each(Object.entries(ROLES))('%s', (role, permissions) => {
    const can = canFor(permissions)
    const user = { id: 'u', first_name: 'A', last_name: 'B', username: 'x', email: null, is_owner: false, role, permissions } as User
    for (const tab of getTabs(user)) {
      expect(isRouteAllowed(tab.href, can), `onglet ${tab.href}`).toBe(true)
    }
    // Même filtre que GlassSidebar (lib/permissions/route-permissions.ts).
    for (const item of [...ACTIVITY_ITEMS, ...ACCOUNT_ITEMS].filter((i) => isRouteAllowed(i.href, can))) {
      expect(isRouteAllowed(item.href, can)).toBe(true)
    }
  })
})
