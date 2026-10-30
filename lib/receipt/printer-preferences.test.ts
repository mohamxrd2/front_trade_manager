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
  readCompatibilityMode,
  writeCompatibilityMode,
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

describe('mode compatibilité', () => {
  test('désactivé par défaut', () => {
    expect(readCompatibilityMode()).toBe(false)
  })

  test('activation/désactivation persistée', () => {
    writeCompatibilityMode(true)
    expect(readCompatibilityMode()).toBe(true)
    writeCompatibilityMode(false)
    expect(readCompatibilityMode()).toBe(false)
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

