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
  writeDefaultPrintMode,
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
  /**
   * Incrémenté à chaque perte de connexion NON demandée (imprimante éteinte,
   * hors de portée…) — PrinterConnectionWatcher affiche alors un toast.
   */
  lostCount: number

  /** Détecte le support et tente une reconnexion silencieuse à l'appareil mémorisé — sans geste utilisateur, best-effort, jamais bloquant. */
  init: () => Promise<void>
  /** Doit être appelé depuis un geste utilisateur (clic) — contrainte du navigateur. */
  connect: (showAllDevices?: boolean) => Promise<void>
  /** Reconnexion à l'appareil mémorisé si le navigateur le permet sans geste utilisateur ; sinon se comporte comme connect(). */
  reconnect: () => Promise<void>
  disconnect: () => void
  /** Blocs ESC/POS (encodeReceiptEscPosBlocks) — jamais coupés entre deux paquets. */
  print: (blocks: Uint8Array[]) => Promise<PrintResult>
}

type SetState = (partial: Partial<BluetoothPrinterState> | ((state: BluetoothPrinterState) => Partial<BluetoothPrinterState>)) => void
type GetState = () => BluetoothPrinterState

/** Essais de reconnexion silencieuse après une perte ou un échec au chargement (ms). */
export const RECONNECT_DELAYS = [2_000, 5_000, 10_000, 20_000, 30_000]
/** Une imprimante éteinte peut laisser gatt.connect() en attente : on abandonne au-delà. */
const CONNECT_TIMEOUT_MS = 10_000

// Reconnexion silencieuse en cours ou terminée : la même promesse pour tous
// (une impression lancée juste après le chargement peut l'attendre).
let initPromise: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

function cancelRetries() {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
}

function connectWithTimeout(device: BluetoothDevice): Promise<PrinterConnection> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      device.gatt?.disconnect()
      reject(new BluetoothPrinterError('unknown', 'Délai de connexion dépassé'))
    }, CONNECT_TIMEOUT_MS)
    connectToPrinter(device).then(
      (connection) => {
        clearTimeout(timer)
        resolve(connection)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Écoute la déconnexion de CET appareil. Ignorée si ce n'est plus
 * l'imprimante courante (déconnexion demandée, ou changement d'imprimante) :
 * l'état a déjà été mis à jour par disconnect()/connect().
 */
function watchDisconnect(set: SetState, get: GetState, device: BluetoothDevice) {
  device.addEventListener(
    'gattserverdisconnected',
    () => {
      if (get().connection?.device !== device) return
      set((state) => ({ status: 'disconnected', connection: null, batteryLevel: null, lostCount: state.lostCount + 1 }))
      scheduleReconnect(set, get, 0)
    },
    { once: true }
  )
}

/**
 * Connexion établie à `device` (à la main, au chargement ou reconnexion
 * automatique) : état, écoute de la déconnexion, batterie — et « Bluetooth
 * direct » devient le mode d'impression de cet appareil.
 */
async function adoptConnection(set: SetState, get: GetState, device: BluetoothDevice, connection: PrinterConnection, fallbackName: string | null) {
  writeDefaultPrintMode('bluetooth')
  set({ status: 'connected', connection, deviceId: device.id, deviceName: device.name ?? fallbackName, batteryLevel: null })
  watchDisconnect(set, get, device)
  const batteryLevel = await readBatteryLevel(device)
  if (get().connection === connection) set({ batteryLevel })
}

/**
 * Une tentative de reconnexion silencieuse à l'imprimante mémorisée (sans
 * fenêtre). Renvoie false si elle est impossible sur ce navigateur
 * (navigator.bluetooth.getDevices absent, appareil oublié) — inutile de réessayer.
 */
async function attemptSilentReconnect(set: SetState, get: GetState): Promise<'connected' | 'failed' | 'impossible'> {
  const remembered = readRememberedPrinter()
  if (!remembered) return 'impossible'
  const device = await findKnownDevice(remembered.id)
  if (!device) return 'impossible'
  if (get().status === 'connected') return 'connected'

  set({ status: 'connecting', deviceId: remembered.id, deviceName: remembered.name })
  try {
    const connection = await connectWithTimeout(device)
    await adoptConnection(set, get, device, connection, remembered.name)
    return 'connected'
  } catch {
    // Imprimante éteinte, hors de portée… — rouge, on réessaiera plus tard.
    if (get().status === 'connecting') set({ status: 'disconnected', connection: null })
    return 'failed'
  }
}

function scheduleReconnect(set: SetState, get: GetState, attempt: number) {
  cancelRetries()
  if (attempt >= RECONNECT_DELAYS.length) return
  retryTimer = setTimeout(async () => {
    retryTimer = null
    // Entre-temps : connecté à la main, ou déconnecté volontairement (plus d'imprimante mémorisée).
    if (get().status === 'connected' || get().status === 'connecting' || !readRememberedPrinter()) return
    const result = await attemptSilentReconnect(set, get)
    if (result === 'failed') scheduleReconnect(set, get, attempt + 1)
  }, RECONNECT_DELAYS[attempt])
}

/** Reconnexion silencieuse au chargement : un essai, puis quelques autres espacés s'il échoue. */
async function silentReconnect(set: SetState, get: GetState): Promise<void> {
  if (!isWebBluetoothSupported()) {
    set({ status: 'unsupported' })
    return
  }
  const remembered = readRememberedPrinter()
  if (!remembered) return
  set({ deviceId: remembered.id, deviceName: remembered.name })

  const result = await attemptSilentReconnect(set, get)
  if (result === 'failed') scheduleReconnect(set, get, 0)
}

export const useBluetoothPrinterStore = create<BluetoothPrinterState>()((set, get) => ({
  status: 'disconnected',
  deviceId: null,
  deviceName: null,
  batteryLevel: null,
  connection: null,
  lostCount: 0,

  init: () => {
    // Idempotent : appelé depuis plusieurs points d'entrée possibles
    // (Paramètres, Nouvelle vente, écran de confirmation…) sans savoir lequel
    // monte en premier — une seule tentative de reconnexion silencieuse par session.
    initPromise ??= silentReconnect(set, get)
    return initPromise
  },

  connect: async (showAllDevices = false) => {
    if (!isWebBluetoothSupported()) {
      set({ status: 'unsupported' })
      return
    }
    cancelRetries()
    const previous = get().connection
    set({ status: 'connecting' })
    try {
      // Aucun await avant : la fenêtre du navigateur exige le geste (clic) de l'utilisateur.
      const device = await requestPrinterDevice(showAllDevices)
      const connection = await connectToPrinter(device)
      writeRememberedPrinter({ id: device.id, name: device.name ?? 'Imprimante' }) // i18n:allow — nom de secours mémorisé, pas affiché tel quel
      await adoptConnection(set, get, device, connection, null)
      // Changement d'imprimante : l'ancienne n'est plus la courante, sa déconnexion est ignorée.
      if (previous && previous.device !== device) disconnectPrinter(previous)
    } catch (error) {
      if (error instanceof BluetoothPrinterError && error.code === 'cancelled') {
        // Fenêtre fermée : on garde l'imprimante déjà connectée, s'il y en a une.
        set({ status: previous ? 'connected' : 'disconnected' })
        return
      }
      set({ status: previous ? 'connected' : 'error' })
      throw error
    }
  },

  reconnect: async () => {
    const remembered = readRememberedPrinter()
    if (!remembered) {
      await get().connect()
      return
    }
    cancelRetries()
    set({ status: 'connecting' })
    const device = await findKnownDevice(remembered.id)
    if (!device) {
      // Le navigateur ne permet pas de retrouver l'appareil sans geste utilisateur — repli sur une vraie sélection.
      await get().connect()
      return
    }

    try {
      const connection = await connectWithTimeout(device)
      await adoptConnection(set, get, device, connection, remembered.name)
    } catch (error) {
      set({ status: 'error' })
      throw error
    }
  },

  disconnect: () => {
    cancelRetries()
    const { connection } = get()
    clearRememberedPrinter()
    // L'état d'abord : l'événement gattserverdisconnected qui suit est alors ignoré (pas de toast, pas de reconnexion).
    set({ status: 'disconnected', connection: null, deviceId: null, deviceName: null, batteryLevel: null })
    disconnectPrinter(connection)
  },

  print: async (blocks) => {
    const { connection, status } = get()
    if (status !== 'connected' || !connection) {
      return { ok: false, errorCode: 'not-connected' }
    }
    try {
      await sendToPrinter(connection.characteristic, blocks)
      return { ok: true }
    } catch {
      set({ status: 'disconnected', connection: null })
      return { ok: false, errorCode: 'write-failed' }
    }
  },
}))

/** Tests uniquement : repart d'une session vierge (promesse d'init, essais programmés). */
export function resetBluetoothPrinterForTests() {
  cancelRetries()
  initPromise = null
  useBluetoothPrinterStore.setState({ status: 'disconnected', deviceId: null, deviceName: null, batteryLevel: null, connection: null, lostCount: 0 })
}
