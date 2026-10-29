import { describe, expect, test } from 'vitest'
import type { User } from '@/lib/auth'
import { getTabs } from './tabs'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    first_name: 'Koffi',
    last_name: 'Yao',
    username: 'koffi',
    email: 'koffi@example.com',
    is_owner: false,
    role: null,
    permissions: [],
    ...overrides,
  }
}

describe('getTabs — navigation adaptée au rôle (chantier "Équipe" §6)', () => {
  test('sans utilisateur : onglets par défaut (propriétaire)', () => {
    const ids = getTabs(null).map((t) => t.id)
    expect(ids).toEqual(['home', 'stock', 'wallet', 'invoices', 'analytics'])
  })

  test('caissier (sales.create, sales.view_own, stock.view, sans wallet.view_balance) : Caisse · Vente · Mes ventes · Stock', () => {
    const cashier = makeUser({ role: 'cashier', permissions: ['sales.create', 'sales.view_own', 'stock.view'] })
    const tabs = getTabs(cashier)
    expect(tabs.map((t) => t.id)).toEqual(['home', 'sale', 'my-sales', 'stock'])
    expect(tabs[0].href).toBe('/dashboard')
  })

  test('gestionnaire de stock : accueil redirige vers /products, pas de doublon avec l\'onglet Stock', () => {
    const stockManager = makeUser({ role: 'stock_manager', permissions: ['stock.view', 'stock.edit', 'stock.restock'] })
    const tabs = getTabs(stockManager)
    expect(tabs.map((t) => t.id)).toEqual(['home'])
    expect(tabs[0].href).toBe('/products')
  })

  test('comptable : accueil redirige vers /analytics (déduplique l\'onglet Analyses, même href), garde portefeuille et factures', () => {
    const accountant = makeUser({
      role: 'accountant',
      permissions: ['wallet.view_balance', 'analytics.view', 'invoices.view', 'sales.view_all'],
    })
    const tabs = getTabs(accountant)
    expect(tabs.map((t) => t.id)).toEqual(['home', 'wallet', 'invoices'])
    expect(tabs[0].href).toBe('/analytics')
  })

  test('gérant avec toutes les permissions sauf team.manage/settings.manage : nav complète, pas de Vente/Mes ventes (a déjà /wallet)', () => {
    const manager = makeUser({
      role: 'manager',
      permissions: ['sales.create', 'sales.view_all', 'stock.view', 'wallet.view_balance', 'invoices.view', 'analytics.view'],
    })
    const tabs = getTabs(manager)
    expect(tabs.map((t) => t.id)).toEqual(['home', 'stock', 'wallet', 'invoices', 'analytics'])
  })

  test('membre sans aucune permission : seulement l\'accueil', () => {
    const noPerms = makeUser({ role: 'cashier', permissions: [] })
    expect(getTabs(noPerms).map((t) => t.id)).toEqual(['home'])
  })
})
