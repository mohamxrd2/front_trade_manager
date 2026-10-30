/**
 * Préférences d'impression Bluetooth — propres à CET APPAREIL/navigateur
 * (un appairage Bluetooth ne se synchronise pas entre appareils, donc
 * localStorage plutôt qu'un réglage serveur comme receipt_settings).
 */

import { DEFAULT_PRINTER_CHARSET, PRINTER_CHARSETS, type PrinterCharset } from './escpos/charsets'

export type DefaultPrintMode = 'bluetooth' | 'classic'

export interface RememberedPrinter {
  id: string
  name: string
}

const DEVICE_KEY = 'waelly-bluetooth-printer'
const MODE_KEY = 'waelly-print-mode'
const COMPAT_KEY = 'waelly-printer-compat-mode'
const CUT_KEY = 'waelly-printer-cut-paper'
const CHARSET_KEY = 'waelly-printer-charset'
const PRINT_LOGO_KEY = 'waelly-printer-print-logo'
const PRINT_QR_KEY = 'waelly-printer-print-qr'

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

/**
 * Table de caractères de l'imprimante (Paramètres → Ticket de caisse →
 * Imprimante). Par défaut CP437 : c'est la table dans laquelle l'imprimante
 * réelle est restée (elle ignorait la commande CP858) et qui imprimait
 * correctement les accents. L'ancien « Mode compatibilité » (accents
 * retirés) devient la table « Sans accents ».
 */
export function readPrinterCharset(): PrinterCharset {
  const raw = readLocalStorage(CHARSET_KEY)
  if (raw && (PRINTER_CHARSETS as string[]).includes(raw)) return raw as PrinterCharset
  if (readLocalStorage(COMPAT_KEY) === '1') return 'ascii'
  return DEFAULT_PRINTER_CHARSET
}

export function writePrinterCharset(charset: PrinterCharset): void {
  writeLocalStorage(CHARSET_KEY, charset)
}

/** Imprimer le logo en ESC/POS — désactivé par défaut (commande d'image pas toujours comprise). */
export function readPrintLogo(): boolean {
  return readLocalStorage(PRINT_LOGO_KEY) === '1'
}

export function writePrintLogo(value: boolean): void {
  writeLocalStorage(PRINT_LOGO_KEY, value ? '1' : '0')
}

/** Imprimer le QR code en ESC/POS — désactivé par défaut. */
export function readPrintQr(): boolean {
  return readLocalStorage(PRINT_QR_KEY) === '1'
}

export function writePrintQr(value: boolean): void {
  writeLocalStorage(PRINT_QR_KEY, value ? '1' : '0')
}

export function readCutPaper(): boolean {
  return readLocalStorage(CUT_KEY) === '1'
}

export function writeCutPaper(value: boolean): void {
  writeLocalStorage(CUT_KEY, value ? '1' : '0')
}
