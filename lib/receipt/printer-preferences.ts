/**
 * Préférences d'impression Bluetooth — propres à CET APPAREIL/navigateur
 * (un appairage Bluetooth ne se synchronise pas entre appareils, donc
 * localStorage plutôt qu'un réglage serveur comme receipt_settings).
 */

export type DefaultPrintMode = 'bluetooth' | 'classic'

export interface RememberedPrinter {
  id: string
  name: string
}

const DEVICE_KEY = 'waelly-bluetooth-printer'
const MODE_KEY = 'waelly-print-mode'
const COMPAT_KEY = 'waelly-printer-compat-mode'
const CUT_KEY = 'waelly-printer-cut-paper'
const AUTO_PRINT_KEY = 'waelly-auto-print'

function readLocalStorage(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {
    // Best-effort — navigation privée ou quota dépassé.
  }
}

function removeLocalStorage(key: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // Best-effort.
  }
}

export function readRememberedPrinter(): RememberedPrinter | null {
  const raw = readLocalStorage(DEVICE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.id === 'string' && typeof parsed?.name === 'string') return parsed
    return null
  } catch {
    return null
  }
}

export function writeRememberedPrinter(printer: RememberedPrinter): void {
  writeLocalStorage(DEVICE_KEY, JSON.stringify(printer))
}

export function clearRememberedPrinter(): void {
  removeLocalStorage(DEVICE_KEY)
}

export function readDefaultPrintMode(): DefaultPrintMode {
  return readLocalStorage(MODE_KEY) === 'bluetooth' ? 'bluetooth' : 'classic'
}

export function writeDefaultPrintMode(mode: DefaultPrintMode): void {
  writeLocalStorage(MODE_KEY, mode)
}

export function readCompatibilityMode(): boolean {
  return readLocalStorage(COMPAT_KEY) === '1'
}

export function writeCompatibilityMode(value: boolean): void {
  writeLocalStorage(COMPAT_KEY, value ? '1' : '0')
}

export function readCutPaper(): boolean {
  return readLocalStorage(CUT_KEY) === '1'
}

export function writeCutPaper(value: boolean): void {
  writeLocalStorage(CUT_KEY, value ? '1' : '0')
}

/**
 * Impression automatique après chaque vente, réglée SUR CET APPAREIL (le
 * caissier ne peut pas modifier les réglages du ticket de l'entreprise).
 * `null` : pas de choix sur cet appareil → le réglage de l'entreprise
 * (receipt_settings.auto_print) s'applique.
 */
export function readAutoPrintPreference(): boolean | null {
  const raw = readLocalStorage(AUTO_PRINT_KEY)
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

export function writeAutoPrintPreference(value: boolean): void {
  writeLocalStorage(AUTO_PRINT_KEY, value ? '1' : '0')
}

/** Choix de l'appareil s'il existe, sinon réglage de l'entreprise. */
export function resolveAutoPrint(devicePreference: boolean | null, accountSetting: boolean | null | undefined): boolean {
  return devicePreference ?? accountSetting ?? false
}

