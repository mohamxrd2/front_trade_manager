import { describe, expect, test } from 'vitest'

import { articleStockStatus, variationStockStatus } from './stock-status'

const v = (remaining_quantity: number, low_stock = false) => ({ remaining_quantity, low_stock })

describe('statut de stock affiché', () => {
  test('variation à 0 en stock jamais vendue (0 % vendu, low_stock faux) : rupture, pas « Disponible »', () => {
    expect(variationStockStatus(v(0, false))).toBe('out')
  })

  test('variation : rupture même si le serveur la dit « faible » ; faible ; disponible', () => {
    expect(variationStockStatus(v(0, true))).toBe('out')
    expect(variationStockStatus(v(-2, false))).toBe('out')
    expect(variationStockStatus(v(3, true))).toBe('low')
    expect(variationStockStatus(v(3, false))).toBe('available')
  })

  test('article simple à 0 : rupture ; sinon selon son seuil', () => {
    expect(articleStockStatus({ type: 'simple', ...v(0) })).toBe('out')
    expect(articleStockStatus({ type: 'simple', ...v(5, true) })).toBe('low')
    expect(articleStockStatus({ type: 'simple', ...v(5) })).toBe('available')
  })

  test('article à variantes : rupture si toutes sont à 0 ; faible si l’une est à 0 ou faible', () => {
    expect(articleStockStatus({ type: 'variable', ...v(0), variations: [v(0), v(0)] })).toBe('out')
    expect(articleStockStatus({ type: 'variable', ...v(4), variations: [v(4), v(0)] })).toBe('low')
    expect(articleStockStatus({ type: 'variable', ...v(6), variations: [v(4), v(2, true)] })).toBe('low')
    expect(articleStockStatus({ type: 'variable', ...v(6), variations: [v(4), v(2)] })).toBe('available')
  })
})
