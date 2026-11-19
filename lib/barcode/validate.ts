/**
 * Codes-barres acceptés — mêmes règles que le serveur (App\Support\Barcode) :
 * EAN-13, EAN-8, UPC-A, UPC-E (clé de contrôle vérifiée) ou Code 128
 * (lettres, chiffres, - . / — 4 à 32 caractères). Un code tout en chiffres
 * de 8, 12 ou 13 caractères est forcément un EAN/UPC : une clé fausse est
 * une faute de frappe, pas un Code 128.
 */

export type BarcodeFormat = 'ean13' | 'ean8' | 'upca' | 'upce' | 'code128'
export type BarcodeError = 'empty' | 'check_digit' | 'format'

export type BarcodeValidation = { ok: true; format: BarcodeFormat } | { ok: false; error: BarcodeError }

/** Supprime tous les espaces (début, fin et milieu : « 3 017620 422003 »). */
export function normalizeBarcode(code: string | null | undefined): string {
  return (code ?? '').replace(/\s+/g, '')
}

/** Clé de contrôle GS1 (EAN-13, EAN-8, UPC-A) des chiffres SANS la clé. */
export function gtinCheckDigit(digits: string): number {
  let sum = 0
  let weight = 3
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight
    weight = weight === 3 ? 1 : 3
  }
  return (10 - (sum % 10)) % 10
}

export function hasValidCheckDigit(code: string): boolean {
  return /^\d{8,}$/.test(code) && gtinCheckDigit(code.slice(0, -1)) === Number(code.slice(-1))
}

/** UPC-E (8 chiffres, système 0 ou 1) → UPC-A (12 chiffres), clé comprise. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const system = code[0]
  const d = code.slice(1, 7)
  const check = code[7]
  let body: string
  switch (d[5]) {
    case '0':
    case '1':
    case '2':
      body = d[0] + d[1] + d[5] + '0000' + d[2] + d[3] + d[4]
      break
    case '3':
      body = d[0] + d[1] + d[2] + '00000' + d[3] + d[4]
      break
    case '4':
      body = d[0] + d[1] + d[2] + d[3] + '00000' + d[4]
      break
    default:
      body = d[0] + d[1] + d[2] + d[3] + d[4] + '0000' + d[5]
  }
  return system + body + check
}

export function isValidUpcE(code: string): boolean {
  const upcA = expandUpcE(code)
  return upcA !== null && hasValidCheckDigit(upcA)
}

export function validateBarcode(raw: string): BarcodeValidation {
  const code = normalizeBarcode(raw)
  if (code === '') return { ok: false, error: 'empty' }

  if (/^\d+$/.test(code) && [8, 12, 13].includes(code.length)) {
    if (hasValidCheckDigit(code)) {
      return { ok: true, format: code.length === 13 ? 'ean13' : code.length === 12 ? 'upca' : 'ean8' }
    }
    if (code.length === 8 && isValidUpcE(code)) return { ok: true, format: 'upce' }
    return { ok: false, error: 'check_digit' }
  }

  if (/^[A-Za-z0-9./-]{4,32}$/.test(code)) return { ok: true, format: 'code128' }
  return { ok: false, error: 'format' }
}

/** EAN-13 complet (avec sa clé) à partir de 12 chiffres. */
export function ean13(twelveDigits: string): string {
  return twelveDigits + gtinCheckDigit(twelveDigits)
}
