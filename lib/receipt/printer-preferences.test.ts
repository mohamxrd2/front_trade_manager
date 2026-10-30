import { beforeEach, describe, expect, test, vi } from 'vitest'

function installFakeLocalStorage() {
  const data = new Map<string, string>()
  const fake: Storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size
    },
  }
  vi.stubGlobal('localStorage', fake)
  return data
}

installFakeLocalStorage()

const {
  readRememberedPrinter,
  writeRememberedPrinter,
  clearRememberedPrinter,
  readDefaultPrintMode,
  writeDefaultPrintMode,
  readPrinterCharset,
  writePrinterCharset,
  readPrintLogo,
  writePrintLogo,
  readPrintQr,
  writePrintQr,
  readCutPaper,
  writeCutPaper,
} = await import('./printer-preferences')

beforeEach(() => {
  localStorage.clear()
})

describe('appareil mémorisé', () => {
  test('aucun appareil mémorisé -> null', () => {
    expect(readRememberedPrinter()).toBeNull()
  })

  test('mémorise puis relit un appareil (id + nom)', () => {
    writeRememberedPrinter({ id: 'abc-123', name: 'XP-T80Q' })
    expect(readRememberedPrinter()).toEqual({ id: 'abc-123', name: 'XP-T80Q' })
  })

  test('clearRememberedPrinter oublie l’appareil', () => {
    writeRememberedPrinter({ id: 'abc-123', name: 'XP-T80Q' })
    clearRememberedPrinter()
    expect(readRememberedPrinter()).toBeNull()
  })

  test('une valeur corrompue en storage ne fait jamais planter la lecture', () => {
    localStorage.setItem('waelly-bluetooth-printer', '{not valid json')
    expect(readRememberedPrinter()).toBeNull()
  })

  test('un objet JSON valide mais incomplet (sans id/name) est rejeté', () => {
    localStorage.setItem('waelly-bluetooth-printer', JSON.stringify({ foo: 'bar' }))
    expect(readRememberedPrinter()).toBeNull()
  })
})

describe('mode d’impression par défaut', () => {
  test('par défaut (rien de réglé) : "classic"', () => {
    expect(readDefaultPrintMode()).toBe('classic')
  })

  test('bascule sur "bluetooth" puis revient à "classic"', () => {
    writeDefaultPrintMode('bluetooth')
    expect(readDefaultPrintMode()).toBe('bluetooth')
    writeDefaultPrintMode('classic')
    expect(readDefaultPrintMode()).toBe('classic')
  })
})

describe('table de caractères', () => {
  test('CP437 par défaut (la table de l’imprimante réelle, qui imprimait bien les accents)', () => {
    expect(readPrinterCharset()).toBe('cp437')
  })

  test('choix persisté', () => {
    writePrinterCharset('cp858')
    expect(readPrinterCharset()).toBe('cp858')
  })

  test('l’ancien « Mode compatibilité » activé devient la table « Sans accents »', () => {
    localStorage.setItem('waelly-printer-compat-mode', '1')
    expect(readPrinterCharset()).toBe('ascii')
  })

  test('une valeur inconnue en storage retombe sur CP437', () => {
    localStorage.setItem('waelly-printer-charset', 'utf8')
    expect(readPrinterCharset()).toBe('cp437')
  })
})

describe('logo et QR code en ESC/POS', () => {
  test('désactivés par défaut', () => {
    expect(readPrintLogo()).toBe(false)
    expect(readPrintQr()).toBe(false)
  })

  test('activation persistée', () => {
    writePrintLogo(true)
    writePrintQr(true)
    expect(readPrintLogo()).toBe(true)
    expect(readPrintQr()).toBe(true)
  })
})

describe('coupe papier', () => {
  test('désactivée par défaut (toutes les imprimantes n’ont pas de massicot)', () => {
    expect(readCutPaper()).toBe(false)
  })

  test('activation/désactivation persistée', () => {
    writeCutPaper(true)
    expect(readCutPaper()).toBe(true)
  })
})

describe('resolveAutoPrint — impression automatique après une vente', () => {
  test('le choix fait sur cet appareil l’emporte sur le réglage de l’entreprise', async () => {
    const { resolveAutoPrint } = await import('./printer-preferences')
    expect(resolveAutoPrint(true, false)).toBe(true)
    expect(resolveAutoPrint(false, true)).toBe(false)
  })

  test('aucun choix sur l’appareil : réglage de l’entreprise, sinon désactivé', async () => {
    const { resolveAutoPrint } = await import('./printer-preferences')
    expect(resolveAutoPrint(null, true)).toBe(true)
    expect(resolveAutoPrint(null, undefined)).toBe(false)
  })
})

