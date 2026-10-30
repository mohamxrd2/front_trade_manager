import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * Environnement vitest : `environment: 'node'` (pas de jsdom) — on
 * installe un faux `window`/`BroadcastChannel`/`localStorage` minimal,
 * même convention que lib/amount-visibility/storage.test.ts.
 */

class FakeBroadcastChannel {
  static registry = new Map<string, Set<FakeBroadcastChannel>>()

  name: string
  private listeners: Array<(event: { data: unknown }) => void> = []

  constructor(name: string) {
    this.name = name
    if (!FakeBroadcastChannel.registry.has(name)) {
      FakeBroadcastChannel.registry.set(name, new Set())
    }
    FakeBroadcastChannel.registry.get(name)!.add(this)
  }

  postMessage(data: unknown) {
    for (const other of FakeBroadcastChannel.registry.get(this.name) ?? []) {
      // Une vraie BroadcastChannel ne livre jamais à l'émetteur lui-même.
      if (other === this) continue
      for (const cb of other.listeners) cb({ data })
    }
  }

  addEventListener(type: string, cb: (event: { data: unknown }) => void) {
    if (type === 'message') this.listeners.push(cb)
  }

  removeEventListener(type: string, cb: (event: { data: unknown }) => void) {
    if (type !== 'message') return
    this.listeners = this.listeners.filter((l) => l !== cb)
  }

  static reset() {
    FakeBroadcastChannel.registry.clear()
  }
}

/** EventTarget minimal pour `window` — seul `storage` est utilisé par ce module. */
function installFakeWindow() {
  const store = new Map<string, string>()
  const storageListeners: Array<(event: { key: string | null }) => void> = []

  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => store.delete(key),
    },
    addEventListener: (type: string, cb: (event: { key: string | null }) => void) => {
      if (type === 'storage') storageListeners.push(cb)
    },
    removeEventListener: (type: string, cb: (event: { key: string | null }) => void) => {
      if (type !== 'storage') return
      const i = storageListeners.indexOf(cb)
      if (i !== -1) storageListeners.splice(i, 1)
    },
  }

  // @ts-expect-error -- environnement de test node, pas de vrai `window`.
  globalThis.window = fakeWindow

  return {
    store,
    dispatchStorageEvent: (key: string) => {
      for (const cb of storageListeners) cb({ key })
    },
  }
}

describe('displayedAccountIdOf', () => {
  test('propriétaire (account_id null) : le compte affiché est son propre id', async () => {
    const { displayedAccountIdOf } = await import('./session-sync')
    expect(displayedAccountIdOf({ id: 'owner-1', account_id: null })).toBe('owner-1')
  })

  test('membre (account_id défini) : le compte affiché est account_id, jamais son propre id', async () => {
    const { displayedAccountIdOf } = await import('./session-sync')
    expect(displayedAccountIdOf({ id: 'member-1', account_id: 'owner-1' })).toBe('owner-1')
  })

  test('account_id absent (réponse login() brute) : repli sur id, comme User::accountId() côté backend', async () => {
    const { displayedAccountIdOf } = await import('./session-sync')
    expect(displayedAccountIdOf({ id: 'owner-1' })).toBe('owner-1')
  })
})

describe('getDisplayedAccountId / setDisplayedAccountId', () => {
  test('valeur par défaut null, puis reflète la dernière valeur posée', async () => {
    vi.resetModules()
    const { getDisplayedAccountId, setDisplayedAccountId } = await import('./session-sync')
    expect(getDisplayedAccountId()).toBeNull()

    setDisplayedAccountId('account-1')
    expect(getDisplayedAccountId()).toBe('account-1')

    setDisplayedAccountId(null)
    expect(getDisplayedAccountId()).toBeNull()
  })
})

describe('announceSessionChange / onSessionChange — via BroadcastChannel', () => {
  beforeEach(() => {
    FakeBroadcastChannel.reset()
    // @ts-expect-error -- pas de vrai `window` dans l'environnement node de test.
    globalThis.window = {}
    // @ts-expect-error -- BroadcastChannel global simulé pour le test.
    globalThis.BroadcastChannel = FakeBroadcastChannel
  })

  afterEach(() => {
    // @ts-expect-error -- nettoyage entre tests.
    delete globalThis.BroadcastChannel
    // @ts-expect-error -- nettoyage entre tests.
    delete globalThis.window
  })

  test('un autre onglet (autre instance BroadcastChannel) reçoit announceSessionChange()', async () => {
    vi.resetModules()
    const { announceSessionChange } = await import('./session-sync')

    const otherTabChannel = new FakeBroadcastChannel('waelly-session-sync')
    const received = vi.fn()
    otherTabChannel.addEventListener('message', received)

    announceSessionChange()

    expect(received).toHaveBeenCalledTimes(1)
  })

  test("onSessionChange() s'active quand un AUTRE onglet annonce un changement", async () => {
    vi.resetModules()
    const { onSessionChange } = await import('./session-sync')

    const callback = vi.fn()
    const unsubscribe = onSessionChange(callback)

    const otherTabChannel = new FakeBroadcastChannel('waelly-session-sync')
    otherTabChannel.postMessage(Date.now())

    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    otherTabChannel.postMessage(Date.now())
    expect(callback).toHaveBeenCalledTimes(1) // désabonné : plus d'appel
  })

  test("un onglet ne reçoit jamais SA PROPRE annonce (BroadcastChannel ne se livre pas à l'émetteur)", async () => {
    vi.resetModules()
    const { announceSessionChange, onSessionChange } = await import('./session-sync')

    const callback = vi.fn()
    onSessionChange(callback)

    announceSessionChange()

    expect(callback).not.toHaveBeenCalled()
  })
})

describe('announceSessionChange / onSessionChange — repli localStorage (sans BroadcastChannel)', () => {
  beforeEach(() => {
    // @ts-expect-error -- simuler un navigateur sans BroadcastChannel (Safari < 15.4).
    delete globalThis.BroadcastChannel
  })

  test('announceSessionChange() écrit dans localStorage ; onSessionChange() réagit à `storage`', async () => {
    vi.resetModules()
    const { store, dispatchStorageEvent } = installFakeWindow()
    const { announceSessionChange, onSessionChange } = await import('./session-sync')

    const callback = vi.fn()
    onSessionChange(callback)

    announceSessionChange()

    expect(store.size).toBe(1)
    const [key] = [...store.keys()]

    dispatchStorageEvent(key)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  test('un évènement `storage` sur une AUTRE clé est ignoré', async () => {
    vi.resetModules()
    const { dispatchStorageEvent } = installFakeWindow()
    const { onSessionChange } = await import('./session-sync')

    const callback = vi.fn()
    onSessionChange(callback)

    dispatchStorageEvent('une-autre-cle-sans-rapport')
    expect(callback).not.toHaveBeenCalled()
  })

  test('sans window (SSR), announceSessionChange()/onSessionChange() ne jettent jamais', async () => {
    vi.resetModules()
    // @ts-expect-error -- simuler le rendu serveur.
    delete globalThis.window
    const { announceSessionChange, onSessionChange } = await import('./session-sync')

    expect(() => announceSessionChange()).not.toThrow()
    expect(() => onSessionChange(() => {})()).not.toThrow()
  })
})
