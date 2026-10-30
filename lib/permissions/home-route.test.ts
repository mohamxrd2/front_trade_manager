import { describe, expect, test } from 'vitest'
import { homeRouteForUser } from './home-route'

describe('homeRouteForUser — page d\'accueil selon le rôle (chantier "Équipe" §6), cible de redirection après connexion et après une route interdite', () => {
  test('aucun utilisateur : /dashboard', () => {
    expect(homeRouteForUser(null)).toBe('/dashboard')
  })

  test('propriétaire : toujours /dashboard, quel que soit "role"', () => {
    expect(homeRouteForUser({ is_owner: true, role: 'cashier' })).toBe('/dashboard')
  })

  test('gestionnaire de stock : /products (pas de tableau de bord)', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'stock_manager', permissions: ['stock.view', 'stock.edit', 'stock.restock'] })).toBe('/products')
  })

  test('comptable : /analytics', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'accountant', permissions: ['analytics.view', 'wallet.view_balance'] })).toBe('/analytics')
  })

  test('caissier et gérant : /dashboard', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'cashier', permissions: ['sales.create', 'sales.view_own'] })).toBe('/dashboard')
    expect(homeRouteForUser({ is_owner: false, role: 'manager', permissions: ['wallet.view_balance', 'sales.create'] })).toBe('/dashboard')
  })

  test('permissions personnalisées qui retirent la page du rôle : première page autorisée, jamais une page refusée', () => {
    // Comptable à qui on a retiré analytics.view : le portefeuille.
    expect(homeRouteForUser({ is_owner: false, role: 'accountant', permissions: ['wallet.view_balance'] })).toBe('/dashboard')
    // Gestionnaire de stock sans stock.view (cas extrême) : les notifications, toujours ouvertes.
    expect(homeRouteForUser({ is_owner: false, role: 'stock_manager', permissions: [] })).toBe('/notifications')
  })

  test('permissions pas encore chargées : la page du rôle', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'stock_manager' })).toBe('/products')
    expect(homeRouteForUser({ is_owner: false, role: null })).toBe('/dashboard')
  })
})
