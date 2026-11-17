import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('reconnexion silencieuse à l’imprimante', () => {
  test('une seule tentative par session, et une impression peut l’attendre', async () => {
    let resolveDevices: (devices: unknown[]) => void = () => {}
    const getDevices = vi.fn(() => new Promise<unknown[]>((resolve) => (resolveDevices = resolve)))
    vi.stubGlobal('navigator', { bluetooth: { getDevices } })
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'waelly-bluetooth-printer' ? JSON.stringify({ id: 'imp-1', name: 'MTP-II' }) : null), setItem: () => {}, removeItem: () => {} })
    const { useBluetoothPrinterStore } = await import('./bluetooth-printer')

    const first = useBluetoothPrinterStore.getState().init()
    const second = useBluetoothPrinterStore.getState().init()
    expect(second).toBe(first)

    let done = false
    void first.then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false) // encore en cours : l'impression attend

    resolveDevices([]) // imprimante mémorisée introuvable
    await first
    expect(done).toBe(true)
    expect(useBluetoothPrinterStore.getState().status).toBe('disconnected')
  })
})
