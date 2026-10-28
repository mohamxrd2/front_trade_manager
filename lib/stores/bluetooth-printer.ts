import { create } from 'zustand'

import {
  isWebBluetoothSupported,
  requestPrinterDevice,
  findKnownDevice,
  connectToPrinter,
  disconnectPrinter,
  sendToPrinter,
  readBatteryLevel,
  BluetoothPrinterError,
  type PrinterConnection,
} from '@/lib/receipt/bluetooth-transport'
import {
  readRememberedPrinter,
  writeRememberedPrinter,
  clearRememberedPrinter,
} from '@/lib/receipt/printer-preferences'

export type BluetoothPrinterStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'error'

export interface PrintResult {
  ok: boolean
  /** Sentinelle interne (pas affichée telle quelle) — l'appelant choisit le message traduit selon ce code. */
  errorCode?: 'not-connected' | 'write-failed'
}

interface BluetoothPrinterState {
  status: BluetoothPrinterStatus
  deviceId: string | null
  deviceName: string | null
  batteryLevel: number | null
  connection: PrinterConnection | null

  /** Détecte le support et tente une reconnexion silencieuse à l'appareil mémorisé — sans geste utilisateur, best-effort, jamais bloquant. */
  init: () => Promise<void>
  /** Doit être appelé depuis un geste utilisateur (clic) — contrainte du navigateur. */
  connect: (showAllDevices?: boolean) => Promise<void>
  /** Reconnexion à l'appareil mémorisé si le navigateur le permet sans geste utilisateur ; sinon se comporte comme connect(). */
  reconnect: () => Promise<void>
  disconnect: () => void
  print: (bytes: Uint8Array) => Promise<PrintResult>
}

let initStarted = false

function attachDisconnectListener(set: (partial: Partial<BluetoothPrinterState>) => void, device: BluetoothDevice) {
  device.addEventListener(
    'gattserverdisconnected',
    () => {
      set({ status: 'disconnected', connection: null, batteryLevel: null })
    },
    { once: true }
  )
}

export const useBluetoothPrinterStore = create<BluetoothPrinterState>()((set, get) => ({
  status: 'disconnected',
  deviceId: null,
  deviceName: null,
  batteryLevel: null,
  connection: null,

  init: async () => {
    // Idempotent : appelé depuis plusieurs points d'entrée possibles
    // (Paramètres, écran de confirmation…) sans savoir lequel monte en
    // premier — une seule tentative de reconnexion silencieuse par session.
    if (initStarted) return
    initStarted = true

    if (!isWebBluetoothSupported()) {
      set({ status: 'unsupported' })
      return
    }

    const remembered = readRememberedPrinter()
    if (!remembered) return

    set({ deviceId: remembered.id, deviceName: remembered.name })

    const device = await findKnownDevice(remembered.id)
    if (!device) return // Pas de reconnexion silencieuse possible — l'utilisateur devra toucher "Reconnecter".

    try {
      const connection = await connectToPrinter(device)
      attachDisconnectListener(set, device)
      const batteryLevel = await readBatteryLevel(device)
      set({ status: 'connected', connection, deviceId: device.id, deviceName: device.name ?? remembered.name, batteryLevel })
    } catch {
      // Reconnexion silencieuse échouée (imprimante éteinte, hors de portée…) — reste "disconnected", pas une erreur affichée au chargement.
    }
  },

  connect: async (showAllDevices = false) => {
    if (!isWebBluetoothSupported()) {
      set({ status: 'unsupported' })
      return
    }
    set({ status: 'connecting' })
    try {
      const device = await requestPrinterDevice(showAllDevices)
      const connection = await connectToPrinter(device)
      attachDisconnectListener(set, device)
      writeRememberedPrinter({ id: device.id, name: device.name ?? 'Imprimante' })
      const batteryLevel = await readBatteryLevel(device)
      set({ status: 'connected', connection, deviceId: device.id, deviceName: device.name ?? null, batteryLevel })
    } catch (error) {
      if (error instanceof BluetoothPrinterError && error.code === 'cancelled') {
        set({ status: 'disconnected' })
        return
      }
      set({ status: 'error' })
      throw error
    }
  },

  reconnect: async () => {
    const remembered = readRememberedPrinter()
    if (!remembered) {
      await get().connect()
      return
    }

    set({ status: 'connecting' })
    const device = await findKnownDevice(remembered.id)
    if (!device) {
      // Le navigateur ne permet pas de retrouver l'appareil sans geste utilisateur — repli sur une vraie sélection.
      await get().connect()
      return
    }

    try {
      const connection = await connectToPrinter(device)
      attachDisconnectListener(set, device)
      const batteryLevel = await readBatteryLevel(device)
      set({ status: 'connected', connection, deviceId: device.id, deviceName: device.name ?? remembered.name, batteryLevel })
    } catch (error) {
      set({ status: 'error' })
      throw error
    }
  },

  disconnect: () => {
    disconnectPrinter(get().connection)
    clearRememberedPrinter()
    set({ status: 'disconnected', connection: null, deviceId: null, deviceName: null, batteryLevel: null })
  },

  print: async (bytes) => {
    const { connection, status } = get()
    if (status !== 'connected' || !connection) {
      return { ok: false, errorCode: 'not-connected' }
    }
    try {
      await sendToPrinter(connection.characteristic, bytes)
      return { ok: true }
    } catch {
      set({ status: 'disconnected', connection: null })
      return { ok: false, errorCode: 'write-failed' }
    }
  },
}))
