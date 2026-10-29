import { describe, expect, test } from 'vitest'
import { buildWalletSearchUrl, parseWalletSearchUrl, hasActiveSearchFilters } from './wallet-search-url'

const base = { q: '', type: 'all', from: null, to: null, page: 1, paymentMethod: null, createdBy: null }

describe('buildWalletSearchUrl', () => {
  test('aucun filtre actif : juste le chemin, pas de "?"', () => {
    expect(buildWalletSearchUrl('/wallet', base)).toBe('/wallet')
  })

  test('q seul', () => {
    expect(buildWalletSearchUrl('/wallet', { ...base, q: 'robe' })).toBe('/wallet?q=robe')
  })

  test('type seul (pas "all")', () => {
    expect(buildWalletSearchUrl('/wallet', { ...base, type: 'sale' })).toBe('/wallet?type=sale')
  })

  test('plage de dates', () => {
    expect(buildWalletSearchUrl('/wallet', { ...base, from: '2026-10-01', to: '2026-10-31' })).toBe(
      '/wallet?from=2026-10-01&to=2026-10-31'
    )
  })

  test('page > 1 seulement (page 1 omise)', () => {
    expect(buildWalletSearchUrl('/wallet', { ...base, page: 3 })).toBe('/wallet?page=3')
  })

  test('moyen de paiement seul (déeplink depuis Analyses)', () => {
    expect(buildWalletSearchUrl('/wallet', { ...base, paymentMethod: 'wave' })).toBe('/wallet?payment_method=wave')
  })

  test('tous les filtres combinés', () => {
    const url = buildWalletSearchUrl('/wallet', {
      q: 'robe M',
      type: 'sale',
      from: '2026-10-01',
      to: '2026-10-31',
      page: 2,
      paymentMethod: 'wave',
      createdBy: 'member-1',
    })
    const [, qs] = url.split('?')
    const params = new URLSearchParams(qs)
    expect(params.get('q')).toBe('robe M')
    expect(params.get('type')).toBe('sale')
    expect(params.get('from')).toBe('2026-10-01')
    expect(params.get('to')).toBe('2026-10-31')
    expect(params.get('payment_method')).toBe('wave')
    expect(params.get('created_by')).toBe('member-1')
    expect(params.get('page')).toBe('2')
  })

  test('vendeur seul (filtre "Auteur visible")', () => {
    expect(buildWalletSearchUrl('/wallet', { ...base, createdBy: 'member-1' })).toBe('/wallet?created_by=member-1')
  })
})

describe('parseWalletSearchUrl', () => {
  test('querystring vide : valeurs par défaut', () => {
    expect(parseWalletSearchUrl(new URLSearchParams(''))).toEqual(base)
  })

  test('relit tous les paramètres', () => {
    const parsed = parseWalletSearchUrl(
      new URLSearchParams('q=robe&type=sale&from=2026-10-01&to=2026-10-31&page=2&payment_method=wave&created_by=member-1')
    )
    expect(parsed).toEqual({
      q: 'robe',
      type: 'sale',
      from: '2026-10-01',
      to: '2026-10-31',
      page: 2,
      paymentMethod: 'wave',
      createdBy: 'member-1',
    })
  })

  test('page invalide ou négative retombe sur 1', () => {
    expect(parseWalletSearchUrl(new URLSearchParams('page=abc')).page).toBe(1)
    expect(parseWalletSearchUrl(new URLSearchParams('page=-5')).page).toBe(1)
  })

  test('aller-retour build → parse donne le même état', () => {
    const state = { q: 'robe', type: 'sale', from: '2026-10-01', to: '2026-10-31', page: 2, paymentMethod: 'wave', createdBy: 'member-1' }
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

  test('moyen de paiement actif (sans autre filtre) : vrai', () => {
    expect(hasActiveSearchFilters({ q: '', type: 'all', from: null, paymentMethod: 'wave' })).toBe(true)
  })

  test('vendeur actif (sans autre filtre) : vrai', () => {
    expect(hasActiveSearchFilters({ q: '', type: 'all', from: null, createdBy: 'member-1' })).toBe(true)
  })
})
