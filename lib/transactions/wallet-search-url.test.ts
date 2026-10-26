import { describe, expect, test } from 'vitest'
import { buildWalletSearchUrl, parseWalletSearchUrl, hasActiveSearchFilters } from './wallet-search-url'

describe('buildWalletSearchUrl', () => {
  test('aucun filtre actif : juste le chemin, pas de "?"', () => {
    expect(buildWalletSearchUrl('/wallet', { q: '', type: 'all', from: null, to: null, page: 1 })).toBe('/wallet')
  })

  test('q seul', () => {
    expect(buildWalletSearchUrl('/wallet', { q: 'robe', type: 'all', from: null, to: null, page: 1 })).toBe('/wallet?q=robe')
  })

  test('type seul (pas "all")', () => {
    expect(buildWalletSearchUrl('/wallet', { q: '', type: 'sale', from: null, to: null, page: 1 })).toBe('/wallet?type=sale')
  })

  test('plage de dates', () => {
    expect(buildWalletSearchUrl('/wallet', { q: '', type: 'all', from: '2026-10-01', to: '2026-10-31', page: 1 })).toBe(
      '/wallet?from=2026-10-01&to=2026-10-31'
    )
  })

  test('page > 1 seulement (page 1 omise)', () => {
    expect(buildWalletSearchUrl('/wallet', { q: '', type: 'all', from: null, to: null, page: 3 })).toBe('/wallet?page=3')
  })

  test('tous les filtres combinés', () => {
    const url = buildWalletSearchUrl('/wallet', { q: 'robe M', type: 'sale', from: '2026-10-01', to: '2026-10-31', page: 2 })
    const [, qs] = url.split('?')
    const params = new URLSearchParams(qs)
    expect(params.get('q')).toBe('robe M')
    expect(params.get('type')).toBe('sale')
    expect(params.get('from')).toBe('2026-10-01')
    expect(params.get('to')).toBe('2026-10-31')
    expect(params.get('page')).toBe('2')
  })
})

describe('parseWalletSearchUrl', () => {
  test('querystring vide : valeurs par défaut', () => {
    expect(parseWalletSearchUrl(new URLSearchParams(''))).toEqual({ q: '', type: 'all', from: null, to: null, page: 1 })
  })

  test('relit tous les paramètres', () => {
    const parsed = parseWalletSearchUrl(new URLSearchParams('q=robe&type=sale&from=2026-10-01&to=2026-10-31&page=2'))
    expect(parsed).toEqual({ q: 'robe', type: 'sale', from: '2026-10-01', to: '2026-10-31', page: 2 })
  })

  test('page invalide ou négative retombe sur 1', () => {
    expect(parseWalletSearchUrl(new URLSearchParams('page=abc')).page).toBe(1)
    expect(parseWalletSearchUrl(new URLSearchParams('page=-5')).page).toBe(1)
  })

  test('aller-retour build → parse donne le même état', () => {
    const state = { q: 'robe', type: 'sale', from: '2026-10-01', to: '2026-10-31', page: 2 }
    const url = buildWalletSearchUrl('/wallet', state)
    const qs = url.split('?')[1] ?? ''
    expect(parseWalletSearchUrl(new URLSearchParams(qs))).toEqual(state)
  })
})

describe('hasActiveSearchFilters', () => {
  test('aucun filtre : faux', () => {
    expect(hasActiveSearchFilters({ q: '', type: 'all', from: null })).toBe(false)
  })

  test('recherche texte active : vrai', () => {
    expect(hasActiveSearchFilters({ q: 'robe', type: 'all', from: null })).toBe(true)
  })

  test('plage de dates active : vrai', () => {
    expect(hasActiveSearchFilters({ q: '', type: 'all', from: '2026-10-01' })).toBe(true)
  })

  test('type différent de "all" : vrai', () => {
    expect(hasActiveSearchFilters({ q: '', type: 'sale', from: null })).toBe(true)
  })
})
