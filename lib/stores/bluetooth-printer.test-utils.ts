import { vi } from 'vitest'

/**
 * Imprimante Bluetooth simulée (navigator.bluetooth) pour les tests du store
 * et de l'indicateur : requestDevice/getDevices, GATT, une caractéristique
 * d'écriture, et l'événement gattserverdisconnected.
 */
export interface FakePrinter {
  device: BluetoothDevice
  /** Simule l'imprimante éteinte ou hors de portée. */
  powerOff: () => void
  /** Rallume : la prochaine connexion réussit. */
  powerOn: () => void
  written: Uint8Array[]
}

export function fakePrinter(id = 'imp-1', name = 'PT-210'): FakePrinter {
  const listeners: (() => void)[] = []
  const written: Uint8Array[] = []
  let on = true
  const characteristic = {
    properties: { write: true, writeWithoutResponse: false },
    writeValue: vi.fn(async (data: Uint8Array) => {
      written.push(data)
    }),
  }
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      if (!on) throw new Error('Imprimante éteinte')
      gatt.connected = true
      return server
    }),
    disconnect: vi.fn(() => {
      if (!gatt.connected) return
      gatt.connected = false
      listeners.splice(0).forEach((cb) => cb())
    }),
  }
  const server = {
    getPrimaryServices: async () => [{ getCharacteristics: async () => [characteristic] }],
    getPrimaryService: async () => {
      throw new Error('Pas de service batterie')
    },
  }
  const device = {
    id,
    name,
    gatt,
    addEventListener: (type: string, cb: () => void) => {
      if (type === 'gattserverdisconnected') listeners.push(cb)
    },
  } as unknown as BluetoothDevice

  return {
    device,
    written,
    powerOff: () => {
      on = false
      gatt.disconnect()
    },
    powerOn: () => {
      on = true
    },
  }
}

export function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
}

/** navigator.bluetooth simulé : requestDevice renvoie `chosen` (ou « fenêtre fermée »), getDevices les imprimantes déjà autorisées. */
export function stubBluetooth(options: { chosen?: FakePrinter | null; known?: FakePrinter[]; getDevices?: boolean } = {}) {
  const requestDevice = vi.fn(async () => {
    if (!options.chosen) throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError')
    return options.chosen.device
  })
  const bluetooth: Record<string, unknown> = { requestDevice }
  if (options.getDevices !== false) bluetooth.getDevices = vi.fn(async () => (options.known ?? []).map((p) => p.device))
  vi.stubGlobal('navigator', { bluetooth, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile', platform: 'Linux armv8l', maxTouchPoints: 5 })
  return { requestDevice }
}
