import { packetizeBlocks } from './packetize'

/**
 * Connexion Web Bluetooth à une imprimante thermique — code glue navigateur
 * pur (aucune logique testable en dehors d'un vrai navigateur/une vraie
 * imprimante, voir la checklist de test manuel livrée avec ce chantier).
 * Le découpage en paquets (packetize.ts) et l'encodage ESC/POS
 * (escpos-encoder.ts) restent, eux, testés unitairement.
 *
 * Web Bluetooth n'existe QUE sur Chrome/Chromium (Android et ordinateur) —
 * absent sur Safari/iOS. isWebBluetoothSupported() doit systématiquement
 * décider si l'option Bluetooth est proposée à l'utilisateur.
 */

/**
 * Service GATT générique utilisé par la plupart des imprimantes thermiques
 * BLE bon marché (clones Zjiang/Goojprt/compatibles ESC/POS vendus sous de
 * nombreuses marques). Emplacement réservé : ajouter ici le service propre
 * à l'imprimante cible une fois la marque/le modèle communiqués — aucune
 * autre ligne de ce fichier n'a besoin de changer.
 */
export const PRINTER_SERVICE_UUIDS = ['000018f0-0000-1000-8000-00805f9b34fb']

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export class BluetoothPrinterError extends Error {
  code: 'unsupported' | 'cancelled' | 'gatt-unavailable' | 'no-writable-characteristic' | 'unknown'
  constructor(code: BluetoothPrinterError['code'], message: string) {
    super(message)
    this.name = 'BluetoothPrinterError'
    this.code = code
  }
}

export async function requestPrinterDevice(showAllDevices = false): Promise<BluetoothDevice> {
  if (!isWebBluetoothSupported()) {
    throw new BluetoothPrinterError('unsupported', 'Web Bluetooth indisponible sur ce navigateur')
  }

  const options: RequestDeviceOptions = showAllDevices
    ? { acceptAllDevices: true, optionalServices: PRINTER_SERVICE_UUIDS }
    : {
        filters: PRINTER_SERVICE_UUIDS.map((service) => ({ services: [service] })),
        optionalServices: PRINTER_SERVICE_UUIDS,
      }

  try {
    return await navigator.bluetooth.requestDevice(options)
  } catch (error) {
    // L'utilisateur a fermé la fenêtre de sélection — pas une vraie erreur.
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new BluetoothPrinterError('cancelled', 'Aucun appareil sélectionné')
    }
    throw error
  }
}

/**
 * Reconnexion silencieuse à un appareil déjà autorisé — navigator.bluetooth.getDevices()
 * est encore derrière un flag expérimental sur certains Chrome : si absent,
 * on retombe sur `null` et l'appelant propose un simple bouton "Reconnecter"
 * (qui relance requestDevice(), nécessite un geste utilisateur).
 */
export async function findKnownDevice(deviceId: string): Promise<BluetoothDevice | null> {
  if (!isWebBluetoothSupported() || !('getDevices' in navigator.bluetooth)) return null
  try {
    const devices = await navigator.bluetooth.getDevices()
    return devices.find((d) => d.id === deviceId) ?? null
  } catch {
    return null
  }
}

export interface PrinterConnection {
  device: BluetoothDevice
  characteristic: BluetoothRemoteGATTCharacteristic
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  const services = await server.getPrimaryServices()
  for (const service of services) {
    const characteristics = await service.getCharacteristics()
    const writable = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse)
    if (writable) return writable
  }
  throw new BluetoothPrinterError('no-writable-characteristic', "Aucune caractéristique d'écriture trouvée sur cet appareil")
}

export async function connectToPrinter(device: BluetoothDevice): Promise<PrinterConnection> {
  if (!device.gatt) {
    throw new BluetoothPrinterError('gatt-unavailable', 'GATT indisponible sur cet appareil')
  }
  const server = await device.gatt.connect()
  const characteristic = await findWritableCharacteristic(server)
  return { device, characteristic }
}

export function disconnectPrinter(connection: PrinterConnection | null): void {
  connection?.device.gatt?.disconnect()
}

/** Tente de lire le niveau de batterie via le service GATT standard "Battery Service" — absent sur la plupart des imprimantes bon marché, jamais bloquant. */
export async function readBatteryLevel(device: BluetoothDevice): Promise<number | null> {
  try {
    const server = device.gatt?.connected ? device.gatt : await device.gatt?.connect()
    const service = await server?.getPrimaryService('battery_service')
    const characteristic = await service?.getCharacteristic('battery_level')
    const value = await characteristic?.readValue()
    return value ? value.getUint8(0) : null
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Envoie les blocs ESC/POS déjà encodés (encodeReceiptEscPosBlocks), en
 * paquets de ~160 octets qui ne coupent jamais une commande, avec une
 * courte pause entre chaque écriture — beaucoup d'imprimantes BLE bon
 * marché perdent des données si tout est envoyé d'un coup.
 */
export async function sendToPrinter(
  characteristic: BluetoothRemoteGATTCharacteristic,
  blocks: Uint8Array[],
  options: { chunkSize?: number; delayMs?: number } = {}
): Promise<void> {
  // packetizeBlocks() renvoie des Uint8Array<ArrayBuffer> classiques, comme
  // l'exigent writeValue()/writeValueWithoutResponse().
  const packets = packetizeBlocks(blocks, options.chunkSize ?? 160)
  for (const packet of packets) {
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(packet)
    } else {
      await characteristic.writeValue(packet)
    }
    await sleep(options.delayMs ?? 20)
  }
}
