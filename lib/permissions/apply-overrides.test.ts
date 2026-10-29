import { describe, expect, test } from 'vitest'
import { effectivePermissionSet, toggleOverride } from './apply-overrides'

const CASHIER_DEFAULTS = ['sales.create', 'sales.view_own', 'stock.view', 'clients.view']

describe('effectivePermissionSet — mêmes règles que App\\Support\\Permissions::effectivePermissions() côté backend', () => {
  test('sans override : exactement les défauts du rôle', () => {
    expect(effectivePermissionSet(CASHIER_DEFAULTS, [])).toEqual(new Set(CASHIER_DEFAULTS))
  })

  test('granted=true ajoute une permission absente des défauts', () => {
    const set = effectivePermissionSet(CASHIER_DEFAULTS, [{ permission: 'expenses.create', granted: true }])
    expect(set.has('expenses.create')).toBe(true)
  })

  test('granted=false retire une permission présente dans les défauts', () => {
    const set = effectivePermissionSet(CASHIER_DEFAULTS, [{ permission: 'stock.view', granted: false }])
    expect(set.has('stock.view')).toBe(false)
  })

  test('plusieurs overrides combinés', () => {
    const set = effectivePermissionSet(CASHIER_DEFAULTS, [
      { permission: 'stock.view', granted: false },
      { permission: 'sales.delete_own_recent', granted: true },
    ])
    expect(Array.from(set).sort()).toEqual(['clients.view', 'sales.create', 'sales.delete_own_recent', 'sales.view_own'].sort())
  })
})

describe('toggleOverride — ne garde que les permissions qui DIFFÈRENT des défauts (overrides minimaux, chantier "Équipe" §3)', () => {
  test('décocher une permission par défaut ajoute un override granted=false', () => {
    const next = toggleOverride('stock.view', false, CASHIER_DEFAULTS, [])
    expect(next).toEqual([{ permission: 'stock.view', granted: false }])
  })

  test('recocher une permission par défaut après l\'avoir décochée retire l\'override (retour à l\'état par défaut)', () => {
    const afterUncheck = toggleOverride('stock.view', false, CASHIER_DEFAULTS, [])
    const afterRecheck = toggleOverride('stock.view', true, CASHIER_DEFAULTS, afterUncheck)
    expect(afterRecheck).toEqual([])
  })

  test('cocher une permission absente des défauts ajoute un override granted=true', () => {
    const next = toggleOverride('expenses.create', true, CASHIER_DEFAULTS, [])
    expect(next).toEqual([{ permission: 'expenses.create', granted: true }])
  })

  test('ne touche pas aux autres overrides déjà présents', () => {
    const existing = [{ permission: 'expenses.create', granted: true }]
    const next = toggleOverride('stock.view', false, CASHIER_DEFAULTS, existing)
    expect(next).toEqual([{ permission: 'expenses.create', granted: true }, { permission: 'stock.view', granted: false }])
  })
})
