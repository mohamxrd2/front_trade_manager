import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { readStoredAmountsHidden, writeStoredAmountsHidden } from './storage'

/**
 * Environnement de test vitest.config.ts : `environment: 'node'` (pas de
 * jsdom) — donc pas de `window` global par défaut, exactement comme le
 * rendu serveur que ce module doit aussi tolérer. On simule `window` avec un
 * vrai Map en mémoire pour les cas "disponible", et on le retire
 * explicitement pour le cas "absent" (SSR).
 */
function installFakeLocalStorage() {
  const store = new Map<string, string>()
  const fakeLocalStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
  // @ts-expect-error -- environnement de test node, pas de vrai `window`.
  globalThis.window = { localStorage: fakeLocalStorage }
  return store
}

function installThrowingLocalStorage() {
  const fakeLocalStorage = {
    getItem: () => {
      throw new Error('indisponible (navigation privée)')
    },
    setItem: () => {
      throw new Error('indisponible (navigation privée)')
    },
    removeItem: () => {},
  }
  // @ts-expect-error -- environnement de test node, pas de vrai `window`.
  globalThis.window = { localStorage: fakeLocalStorage }
}

describe('readStoredAmountsHidden / writeStoredAmountsHidden', () => {
  afterEach(() => {
    // @ts-expect-error -- nettoyage entre tests (pas de `window` par défaut en environment: 'node').
    delete globalThis.window
    vi.restoreAllMocks()
  })

  test('par défaut (rien de stocké) : montants visibles', () => {
    installFakeLocalStorage()
    expect(readStoredAmountsHidden()).toBe(false)
  })

  test('le réglage est bien sauvegardé puis restauré', () => {
    installFakeLocalStorage()
    writeStoredAmountsHidden(true)
    expect(readStoredAmountsHidden()).toBe(true)

    writeStoredAmountsHidden(false)
    expect(readStoredAmountsHidden()).toBe(false)
  })

  test('`window` absent (rendu serveur) : ne plante pas, repli visible', () => {
    // @ts-expect-error -- simule le rendu serveur (pas de `window`).
    delete globalThis.window
    expect(() => readStoredAmountsHidden()).not.toThrow()
    expect(readStoredAmountsHidden()).toBe(false)
    expect(() => writeStoredAmountsHidden(true)).not.toThrow()
  })

  test('localStorage indisponible (navigation privée, quota…) : ne plante pas, repli visible', () => {
    installThrowingLocalStorage()
    expect(() => readStoredAmountsHidden()).not.toThrow()
    expect(readStoredAmountsHidden()).toBe(false)
    expect(() => writeStoredAmountsHidden(true)).not.toThrow()
  })
})
