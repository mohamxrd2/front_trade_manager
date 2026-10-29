import { describe, expect, test } from 'vitest'
import { homeRouteForUser } from './home-route'

describe('homeRouteForUser — page d\'accueil selon le rôle (chantier "Équipe" §6), cible de redirection après connexion et après une route interdite', () => {
  test('aucun utilisateur : /dashboard', () => {
    expect(homeRouteForUser(null)).toBe('/dashboard')
  })

  test('propriétaire : toujours /dashboard, quel que soit "role"', () => {
    expect(homeRouteForUser({ is_owner: true, role: 'cashier' })).toBe('/dashboard')
  })

  test('gestionnaire de stock : /products', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'stock_manager' })).toBe('/products')
  })

  test('comptable : /analytics', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'accountant' })).toBe('/analytics')
  })

  test('caissier et gérant : /dashboard (pas de page dédiée)', () => {
    expect(homeRouteForUser({ is_owner: false, role: 'cashier' })).toBe('/dashboard')
    expect(homeRouteForUser({ is_owner: false, role: 'manager' })).toBe('/dashboard')
  })

  test('rôle absent (membre sans accès encore configuré) : /dashboard', () => {
    expect(homeRouteForUser({ is_owner: false, role: null })).toBe('/dashboard')
  })
})
