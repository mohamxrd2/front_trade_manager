import { beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * Environnement de test vitest = 'node' (vitest.config.ts), sans DOM — pas
 * de sessionStorage global. Polyfill minimal AVANT d'importer le store
 * (zustand/persist s'y réfère dès sa création) : un simple Map en mémoire
 * suffit, c'est exactement l'API Storage que persist consomme.
 */
function installFakeSessionStorage() {
  const data = new Map<string, string>()
  const fake: Storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size
    },
  }
  vi.stubGlobal('sessionStorage', fake)
  return data
}

const fakeStorageData = installFakeSessionStorage()

// crypto.randomUUID : disponible nativement sur le Node utilisé par vitest
// (>=19) — pas de polyfill nécessaire, le store l'appelle directement.

const { useCartStore, cartTotal, cartItemCount } = await import('./cart')

function makeSimpleLine(overrides: Partial<Parameters<ReturnType<typeof useCartStore.getState>['addLine']>[0]> = {}) {
  return {
    articleId: 'article-1',
    variationId: null,
    articleName: 'Robe wax',
    variationName: null,
    unitPrice: 25000,
    maxStock: 10,
    ...overrides,
  }
}

beforeEach(() => {
  fakeStorageData.clear()
  useCartStore.setState({ lines: [], idempotencyKey: null })
})

describe('panier — ajout, fusion, quantité, retrait, total', () => {
  test('ajoute un article simple avec la quantité 1', () => {
    useCartStore.getState().addLine(makeSimpleLine())
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ articleId: 'article-1', variationId: null, quantity: 1 })
  })

  test('ajouter la même variation deux fois fusionne en une seule ligne (quantité +1, pas de doublon)', () => {
    const line = makeSimpleLine({ articleId: 'article-2', variationId: 'var-m' })
    useCartStore.getState().addLine(line)
    useCartStore.getState().addLine(line)
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(2)
  })

  test('un article différent (ou une variation différente du même article) crée une ligne séparée', () => {
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a', variationId: 'v1' }))
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a', variationId: 'v2' }))
    expect(useCartStore.getState().lines).toHaveLength(2)
  })

  test('la quantité ne dépasse jamais le stock restant (updateQuantity plafonnée)', () => {
    useCartStore.getState().addLine(makeSimpleLine({ maxStock: 3 }))
    const id = useCartStore.getState().lines[0].id
    useCartStore.getState().updateQuantity(id, 10)
    expect(useCartStore.getState().lines[0].quantity).toBe(3)
  })

  test('ajouter au-delà du stock disponible ne dépasse pas non plus le plafond', () => {
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a', maxStock: 1 }))
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a', maxStock: 1 }))
    expect(useCartStore.getState().lines[0].quantity).toBe(1)
  })

  test('updateQuantity refuse une quantité sous 1 (ramenée à 1)', () => {
    useCartStore.getState().addLine(makeSimpleLine())
    const id = useCartStore.getState().lines[0].id
    useCartStore.getState().updateQuantity(id, 0)
    expect(useCartStore.getState().lines[0].quantity).toBe(1)
  })

  test('retire une ligne du panier', () => {
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a' }))
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'b' }))
    const idToRemove = useCartStore.getState().lines[0].id
    useCartStore.getState().removeLine(idToRemove)
    const { lines } = useCartStore.getState()
    expect(lines).toHaveLength(1)
    expect(lines[0].articleId).toBe('b')
  })

  test('cartTotal additionne prix unitaire × quantité sur toutes les lignes', () => {
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a', unitPrice: 12000, maxStock: 10 }))
    useCartStore.getState().updateQuantity(useCartStore.getState().lines[0].id, 2) // 24 000
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'b', unitPrice: 6500, maxStock: 10 })) // 6 500
    expect(cartTotal(useCartStore.getState().lines)).toBe(24000 + 6500)
  })

  test('cartItemCount compte les quantités, pas le nombre de lignes', () => {
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'a', maxStock: 10 }))
    useCartStore.getState().updateQuantity(useCartStore.getState().lines[0].id, 3)
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'b', maxStock: 10 }))
    expect(cartItemCount(useCartStore.getState().lines)).toBe(4)
  })

  test('updatePrice modifie le prix unitaire (prix négocié)', () => {
    useCartStore.getState().addLine(makeSimpleLine())
    const id = useCartStore.getState().lines[0].id
    useCartStore.getState().updatePrice(id, 20000)
    expect(useCartStore.getState().lines[0].unitPrice).toBe(20000)
  })

  test('clampLineToStock ramène la ligne au stock réellement disponible (après un 422)', () => {
    useCartStore.getState().addLine(makeSimpleLine({ maxStock: 5 }))
    const id = useCartStore.getState().lines[0].id
    useCartStore.getState().updateQuantity(id, 5)
    useCartStore.getState().clampLineToStock(id, 2)
    expect(useCartStore.getState().lines[0]).toMatchObject({ maxStock: 2, quantity: 2 })
  })
})

describe('Idempotency-Key', () => {
  test('ensureIdempotencyKey génère une clé puis la réutilise (même soumission, nouvel essai)', () => {
    const first = useCartStore.getState().ensureIdempotencyKey()
    const second = useCartStore.getState().ensureIdempotencyKey()
    expect(first).toBe(second)
    expect(useCartStore.getState().idempotencyKey).toBe(first)
  })

  test('resetIdempotencyKey force la génération d\'une clé différente au prochain essai', () => {
    const first = useCartStore.getState().ensureIdempotencyKey()
    useCartStore.getState().resetIdempotencyKey()
    const second = useCartStore.getState().ensureIdempotencyKey()
    expect(second).not.toBe(first)
  })

  test('clear() vide le panier ET réinitialise l\'Idempotency-Key (nouvelle vente)', () => {
    useCartStore.getState().addLine(makeSimpleLine())
    useCartStore.getState().ensureIdempotencyKey()
    useCartStore.getState().clear()
    expect(useCartStore.getState().lines).toEqual([])
    expect(useCartStore.getState().idempotencyKey).toBeNull()
  })
})

describe('persistance sessionStorage', () => {
  test('le panier est écrit dans sessionStorage après un ajout', () => {
    useCartStore.getState().addLine(makeSimpleLine())
    const raw = fakeStorageData.get('waelly-cart')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed.state.lines).toHaveLength(1)
  })

  test('restaure le panier depuis sessionStorage (coupure/rechargement de l\'onglet)', async () => {
    useCartStore.getState().addLine(makeSimpleLine({ articleId: 'persisted-article' }))
    expect(fakeStorageData.get('waelly-cart')).toBeTruthy()

    // Simule un VRAI rechargement d'onglet : un module tout neuf (nouvelle
    // instance de store créée de zéro), sessionStorage PRÉSERVÉ entre-temps
    // (seul useCartStore.setState() réécrirait le storage, contrairement à
    // un rechargement réel — d'où resetModules() plutôt qu'un simple
    // setState() vide, qui écraserait aussi le storage lui-même).
    vi.resetModules()
    const fresh = await import('./cart')
    await fresh.useCartStore.persist.rehydrate()

    expect(fresh.useCartStore.getState().lines).toHaveLength(1)
    expect(fresh.useCartStore.getState().lines[0].articleId).toBe('persisted-article')
  })
})
