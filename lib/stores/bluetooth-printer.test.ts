import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { RECONNECT_DELAYS, resetBluetoothPrinterForTests, useBluetoothPrinterStore } from './bluetooth-printer'
import { fakePrinter, memoryStorage, stubBluetooth } from './bluetooth-printer.test-utils'

const store = () => useBluetoothPrinterStore.getState()
const remember = (id: string, name: string) => localStorage.setItem('waelly-bluetooth-printer', JSON.stringify({ id, name }))

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  resetBluetoothPrinterForTests()
})

afterEach(() => {
  resetBluetoothPrinterForTests()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('état de l’imprimante', () => {
  test('navigateur sans Web Bluetooth (iPhone, Safari, Firefox) : « non compatible »', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone)' })
    await store().init()
    expect(store().status).toBe('unsupported')
  })

  test('connexion : « connexion… » pendant le choix, puis connectée avec le nom, mémorisée, Bluetooth par défaut', async () => {
    const printer = fakePrinter('imp-1', 'PT-210')
    stubBluetooth({ chosen: printer })

    const pending = store().connect()
    expect(store().status).toBe('connecting')
    await pending

    expect(store()).toMatchObject({ status: 'connected', deviceId: 'imp-1', deviceName: 'PT-210' })
    expect(JSON.parse(localStorage.getItem('waelly-bluetooth-printer')!)).toEqual({ id: 'imp-1', name: 'PT-210' })
    expect(localStorage.getItem('waelly-print-mode')).toBe('bluetooth')
  })

  test('fenêtre fermée sans choisir : déconnectée — ou toujours connectée à l’imprimante précédente', async () => {
    const { requestDevice } = stubBluetooth({ chosen: null })
    await store().connect()
    expect(store().status).toBe('disconnected')

    const printer = fakePrinter()
    stubBluetooth({ chosen: printer })
    await store().connect()
    stubBluetooth({ chosen: null }) // « Changer d'imprimante », puis fenêtre fermée
    await store().connect()
    expect(store()).toMatchObject({ status: 'connected', deviceName: 'PT-210' })
    expect(printer.device.gatt!.connected).toBe(true)
    expect(requestDevice).toHaveBeenCalled()
  })

  test('changer d’imprimante : la nouvelle est connectée, l’ancienne déconnectée sans toast ni « perdue »', async () => {
    const first = fakePrinter('imp-1', 'PT-210')
    const second = fakePrinter('imp-2', 'MTP-II')
    stubBluetooth({ chosen: first })
    await store().connect()
    stubBluetooth({ chosen: second })
    await store().connect()

    expect(store()).toMatchObject({ status: 'connected', deviceId: 'imp-2', deviceName: 'MTP-II', lostCount: 0 })
    expect(first.device.gatt!.connected).toBe(false)
  })
})

describe('gattserverdisconnected', () => {
  test('imprimante éteinte : rouge tout de suite, signalée perdue, puis reconnexion automatique quand elle revient', async () => {
    vi.useFakeTimers()
    const printer = fakePrinter()
    stubBluetooth({ chosen: printer, known: [printer] })
    await store().connect()

    printer.powerOff()
    expect(store()).toMatchObject({ status: 'disconnected', connection: null, lostCount: 1 })

    // 1er essai (2 s) : toujours éteinte → reste rouge.
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS[0])
    expect(store().status).toBe('disconnected')

    // Rallumée : l'essai suivant (5 s) la reconnecte sans fenêtre.
    printer.powerOn()
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS[1])
    expect(store()).toMatchObject({ status: 'connected', deviceName: 'PT-210', lostCount: 1 })
  })

  test('« Déconnecter » : pas de perte signalée, imprimante oubliée, aucune reconnexion', async () => {
    vi.useFakeTimers()
    const printer = fakePrinter()
    stubBluetooth({ chosen: printer, known: [printer] })
    await store().connect()

    store().disconnect()
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS.reduce((a, b) => a + b, 0))

    expect(store()).toMatchObject({ status: 'disconnected', lostCount: 0, deviceName: null })
    expect(localStorage.getItem('waelly-bluetooth-printer')).toBeNull()
    expect(printer.device.gatt!.connected).toBe(false)
  })

  test('sans getDevices (reconnexion silencieuse impossible) : reste rouge, aucun essai', async () => {
    vi.useFakeTimers()
    const printer = fakePrinter()
    stubBluetooth({ chosen: printer, getDevices: false })
    await store().connect()
    printer.powerOff()
    printer.powerOn()
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS.reduce((a, b) => a + b, 0))
    expect(store().status).toBe('disconnected')
    expect(printer.device.gatt!.connect).toHaveBeenCalledTimes(1)
  })
})

describe('reconnexion silencieuse au chargement', () => {
  test('dernière imprimante mémorisée et autorisée : « connexion… » puis connectée, sans fenêtre', async () => {
    const printer = fakePrinter('imp-1', 'PT-210')
    remember('imp-1', 'PT-210')
    const { requestDevice } = stubBluetooth({ known: [printer] })

    const pending = store().init()
    await Promise.resolve()
    await Promise.resolve()
    expect(store().status).toBe('connecting')
    await pending

    expect(store()).toMatchObject({ status: 'connected', deviceName: 'PT-210' })
    expect(requestDevice).not.toHaveBeenCalled()
  })

  test('une seule tentative par session, et une impression peut l’attendre', async () => {
    remember('imp-1', 'PT-210')
    let resolveDevices: (devices: BluetoothDevice[]) => void = () => {}
    vi.stubGlobal('navigator', { bluetooth: { getDevices: () => new Promise<BluetoothDevice[]>((r) => (resolveDevices = r)) } })

    const first = store().init()
    expect(store().init()).toBe(first)

    let done = false
    void first.then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)

    resolveDevices([]) // imprimante mémorisée introuvable
    await first
    expect(done).toBe(true)
    expect(store().status).toBe('disconnected')
  })

  test('imprimante éteinte au chargement : rouge, puis connectée à un essai suivant', async () => {
    vi.useFakeTimers()
    const printer = fakePrinter()
    printer.powerOff()
    remember('imp-1', 'PT-210')
    stubBluetooth({ known: [printer] })

    await store().init()
    expect(store().status).toBe('disconnected')

    printer.powerOn()
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS[0])
    expect(store().status).toBe('connected')
  })
})

describe('impression', () => {
  test('connectée : les blocs partent à l’imprimante ; non connectée : refus clair', async () => {
    const printer = fakePrinter()
    stubBluetooth({ chosen: printer })
    expect(await store().print([new Uint8Array([1, 2, 3])])).toEqual({ ok: false, errorCode: 'not-connected' })

    await store().connect()
    expect(await store().print([new Uint8Array([1, 2, 3])])).toEqual({ ok: true })
    expect(printer.written.length).toBeGreaterThan(0)
  })
})
