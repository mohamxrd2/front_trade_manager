// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import * as React from 'react'

import { createWedgeDetector, useBarcodeWedge } from '@/hooks/useBarcodeWedge'
import { createDuplicateFilter } from './camera'
import { addScannedToCart, articleHasBarcode, findByBarcode } from './scan-to-cart'
import { useCartStore } from '@/lib/stores/cart'
import type { Article, Variation } from '@/lib/services/articles'

function variation(id: string, name: string, extra: Partial<Variation> = {}): Variation {
  return { id, article_id: 'a2', name, quantity: 5, price: 3000, sold_quantity: 0, remaining_quantity: 5, sales_percentage: 0, low_stock: false, ...extra }
}

function article(id: number, name: string, extra: Partial<Article> = {}): Article {
  return {
    id, name, type: 'simple', sale_price: 500, quantity: 10, sold_quantity: 0, remaining_quantity: 10, sales_percentage: 0, low_stock: false, stock_value: 0,
    ...extra,
  }
}

const soap = article(1, 'Savon', { barcode: '3017620422003' })
const pagne = article(2, 'Pagne', {
  type: 'variable',
  variations: [variation('v-red', 'Rouge', { barcode: 'PAGNE-R' }), variation('v-blue', 'Bleu', { barcode: '96385074', remaining_quantity: 0 })],
})
const coca = article(3, 'Coca', { barcode: '036000291452', remaining_quantity: 2 })
const articles = [soap, pagne, coca]

describe('douchette : saisie rapide terminée par Entrée', () => {
  const type = (detector: ReturnType<typeof createWedgeDetector>, text: string, start: number, gap: number) => {
    let at = start
    for (const ch of text) {
      detector.key(ch, at)
      at += gap
    }
    return detector.key('Enter', at)
  }

  test('6 caractères ou plus, moins de 50 ms entre chaque : code lu', () => {
    expect(type(createWedgeDetector(), '3017620422003', 0, 8)).toBe('3017620422003')
    expect(type(createWedgeDetector(), 'SAV-01', 0, 20)).toBe('SAV-01')
  })

  test('frappe humaine (lente) ou code trop court : ignoré', () => {
    expect(type(createWedgeDetector(), '3017620422003', 0, 120)).toBeNull()
    expect(type(createWedgeDetector(), '12345', 0, 5)).toBeNull()
  })

  test('une pause au milieu repart de zéro ; Maj ne casse pas le code', () => {
    const detector = createWedgeDetector()
    detector.key('9', 0)
    detector.key('9', 400) // pause : nouveau départ
    for (const [i, ch] of [...'ABC-12'].entries()) {
      if (ch === 'A') detector.key('Shift', 400 + i * 5)
      detector.key(ch, 401 + i * 5)
    }
    expect(detector.key('Enter', 440)).toBe('9ABC-12')
  })

  describe('hook', () => {
    let now = 0
    beforeEach(() => {
      now = 0
      vi.spyOn(performance, 'now').mockImplementation(() => now)
    })
    afterEach(() => {
      cleanup()
      vi.restoreAllMocks()
    })

    function Harness({ onScan }: { onScan: (code: string) => void }) {
      useBarcodeWedge(onScan)
      return (
        <div>
          <input aria-label="recherche" />
          <button type="button">Bouton</button>
        </div>
      )
    }

    const scanWith = (target: Element, text: string) => {
      for (const ch of text) {
        now += 10
        fireEvent.keyDown(target, { key: ch })
      }
      now += 10
      return fireEvent.keyDown(target, { key: 'Enter' })
    }

    test('aucun champ actif : le code est remis, l’Entrée ne déclenche rien d’autre', () => {
      const onScan = vi.fn()
      const { getByRole } = render(<Harness onScan={onScan} />)
      const notCancelled = scanWith(getByRole('button'), '3017620422003')
      expect(onScan).toHaveBeenCalledWith('3017620422003')
      expect(notCancelled).toBe(false)
    })

    test('un champ a le focus : la frappe lui reste, pas de scan', () => {
      const onScan = vi.fn()
      const { getByRole } = render(<Harness onScan={onScan} />)
      const input = getByRole('textbox')
      input.focus()
      scanWith(input, '3017620422003')
      expect(onScan).not.toHaveBeenCalled()
    })
  })
})

describe('caméra : même code ignoré pendant 1,5 s', () => {
  test('doublon ignoré tant qu’il reste visible ; autre code accepté tout de suite ; même code accepté après 1,5 s sans le voir', () => {
    let now = 0
    const accept = createDuplicateFilter(1500, () => now)
    expect(accept('A')).toBe(true)
    now = 400
    expect(accept('A')).toBe(false)
    now = 500
    expect(accept('B')).toBe(true)
    // A est toujours dans le champ pendant qu'on scanne B : pas de second ajout.
    now = 600
    expect(accept('A')).toBe(false)
    now = 1700
    expect(accept('A')).toBe(false)
    // A écarté de la caméra 1,5 s, puis rescanné : nouvel ajout.
    now = 3300
    expect(accept('A')).toBe(true)
  })
})

describe('ajout au panier par code', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', window.sessionStorage)
    useCartStore.getState().clear()
  })

  const cart = () => useCartStore.getState()

  test('code trouvé (article simple) : ajouté avec son prix', () => {
    const found = findByBarcode(articles, '3017620422003')!
    expect(addScannedToCart(found, cart())).toMatchObject({ kind: 'added', name: 'Savon', quantity: 1 })
    expect(cart().lines).toMatchObject([{ articleId: '1', variationId: null, unitPrice: 500, quantity: 1, maxStock: 10 }])
  })

  test('code d’une variante : la bonne variante est ajoutée', () => {
    const found = findByBarcode(articles, 'PAGNE-R')!
    expect(found.variation?.id).toBe('v-red')
    expect(addScannedToCart(found, cart())).toMatchObject({ kind: 'added', name: 'Pagne — Rouge' })
    expect(cart().lines[0]).toMatchObject({ articleId: '2', variationId: 'v-red', variationName: 'Rouge', unitPrice: 3000 })
  })

  test('déjà au panier : quantité +1, pas de nouvelle ligne', () => {
    const found = findByBarcode(articles, '3017620422003')!
    addScannedToCart(found, cart())
    expect(addScannedToCart(found, cart())).toMatchObject({ kind: 'incremented', quantity: 2 })
    expect(cart().lines).toHaveLength(1)
    expect(cart().lines[0].quantity).toBe(2)
  })

  test('règles de stock : variante épuisée refusée ; tout le stock déjà au panier refusé', () => {
    expect(addScannedToCart(findByBarcode(articles, '96385074')!, cart())).toEqual({ kind: 'out-of-stock', name: 'Pagne — Bleu' })
    const colaFound = findByBarcode(articles, '036000291452')!
    addScannedToCart(colaFound, cart())
    addScannedToCart(colaFound, cart())
    expect(addScannedToCart(colaFound, cart())).toEqual({ kind: 'max-reached', name: 'Coca' })
    expect(cart().lines[0].quantity).toBe(2)
  })

  test('code inconnu : rien trouvé (la page propose « Créer ce produit »)', () => {
    expect(findByBarcode(articles, '0000000000000')).toBeNull()
  })

  test('UPC-A lu avec 13 chiffres : même produit ; la recherche trouve aussi par code exact', () => {
    expect(findByBarcode(articles, '0036000291452')?.article.name).toBe('Coca')
    expect(articleHasBarcode(pagne, 'PAGNE-R')).toBe(true)
    expect(articleHasBarcode(soap, '30176204')).toBe(false)
  })
})
