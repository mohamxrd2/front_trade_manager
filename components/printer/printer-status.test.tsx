// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import { translate } from '@/lib/i18n/translate'
import { resetBluetoothPrinterForTests, useBluetoothPrinterStore } from '@/lib/stores/bluetooth-printer'
import { fakePrinter, memoryStorage, stubBluetooth } from '@/lib/stores/bluetooth-printer.test-utils'
import { PrinterStatus } from './printer-status'
import { PrinterConnectionWatcher } from './printer-connection-watcher'

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => translate(key, 'fr', params), language: 'fr' }),
}))
const printTestTicket = vi.hoisted(() => vi.fn(async () => ({ ok: true })))
vi.mock('@/hooks/usePrintTestTicket', () => ({ usePrintTestTicket: () => printTestTicket }))

const store = () => useBluetoothPrinterStore.getState()
const statusText = () => screen.getByRole('status').textContent

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  resetBluetoothPrinterForTests()
})

afterEach(() => {
  cleanup()
  resetBluetoothPrinterForTests()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('indicateur d’imprimante (Nouvelle vente)', () => {
  test('aucune imprimante : rouge, texte et bouton « Connecter » qui ouvre directement le sélecteur', async () => {
    const printer = fakePrinter('imp-1', 'PT-210')
    const { requestDevice } = stubBluetooth({ chosen: printer })
    const { container } = render(<PrinterStatus />)

    expect(statusText()).toBe('Aucune imprimante')
    expect(container.querySelector('[data-printer-state="disconnected"]')).not.toBeNull()
    expect(container.querySelector('[data-state="disconnected"]')?.className).toContain('bg-danger-dot')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connecter une imprimante de tickets Bluetooth' }))
    })
    expect(requestDevice).toHaveBeenCalledTimes(1)
    expect(statusText()).toBe('Imprimante connectée · PT-210')
  })

  test('connexion en cours : orange, « Connexion… », pas de bouton', () => {
    stubBluetooth()
    useBluetoothPrinterStore.setState({ status: 'connecting' })
    const { container } = render(<PrinterStatus />)
    expect(statusText()).toBe('Connexion…')
    expect(container.querySelector('[data-state="connecting"]')?.className).toContain('bg-amber-500')
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('connectée : vert + nom ; menu « ticket de test », « Changer d’imprimante », « Déconnecter »', async () => {
    const printer = fakePrinter('imp-1', 'PT-210')
    stubBluetooth({ chosen: printer })
    await store().connect()
    const { container } = render(<PrinterStatus />)

    expect(statusText()).toBe('Imprimante connectée · PT-210')
    expect(container.querySelector('[data-state="connected"]')?.className).toContain('bg-success')

    const trigger = screen.getByRole('button', { name: 'Imprimante PT-210 : options' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('menuitem', { name: 'Imprimer un ticket de test' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: "Changer d'imprimante" })).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Imprimer un ticket de test' }))
    })
    expect(printTestTicket).toHaveBeenCalledTimes(1)
    expect(toastMock.success).toHaveBeenCalledWith('Ticket de test envoyé à l\'imprimante')

    fireEvent.keyDown(screen.getByRole('button', { name: 'Imprimante PT-210 : options' }), { key: 'Enter' })
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Déconnecter' }))
    })
    expect(statusText()).toBe('Aucune imprimante')
  })

  test('appareil sans Web Bluetooth : « Impression via partage » avec explication, jamais de bouton « Connecter »', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone)' })
    render(<PrinterStatus />)
    expect(statusText()).toBe('Impression via partage')
    expect(screen.queryByRole('button', { name: /Connecter/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Impression via partage/ }))
    expect(screen.getByText(/AirPrint/)).toBeTruthy()
  })

  test('Paramètres ↔ Nouvelle vente : une connexion faite dans les Paramètres met l’indicateur au vert, et inversement', async () => {
    const printer = fakePrinter('imp-1', 'PT-210')
    stubBluetooth({ chosen: printer })
    render(<PrinterStatus />)
    expect(statusText()).toBe('Aucune imprimante')

    // Paramètres → « Connecter une imprimante » appelle le même store.
    await act(async () => {
      await store().connect()
    })
    expect(statusText()).toBe('Imprimante connectée · PT-210')

    // Paramètres → « Déconnecter » : l'indicateur repasse au rouge.
    act(() => store().disconnect())
    expect(statusText()).toBe('Aucune imprimante')

    // Nouvelle vente → « Connecter » : les Paramètres (même store) voient l'imprimante connectée.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connecter une imprimante de tickets Bluetooth' }))
    })
    expect(store()).toMatchObject({ status: 'connected', deviceName: 'PT-210' })
  })
})

describe('imprimante perdue', () => {
  test('éteinte ou hors de portée : indicateur rouge tout de suite et toast « Imprimante déconnectée »', async () => {
    const printer = fakePrinter('imp-1', 'PT-210')
    stubBluetooth({ chosen: printer, known: [printer] })
    await store().connect()
    render(
      <>
        <PrinterConnectionWatcher />
        <PrinterStatus />
      </>
    )
    expect(statusText()).toBe('Imprimante connectée · PT-210')

    act(() => printer.powerOff())
    expect(statusText()).toBe('Aucune imprimante')
    expect(toastMock.error).toHaveBeenCalledWith('Imprimante déconnectée', expect.objectContaining({ id: 'printer-lost' }))
  })

  test('« Déconnecter » volontaire : aucun toast', async () => {
    const printer = fakePrinter()
    stubBluetooth({ chosen: printer, known: [printer] })
    await store().connect()
    render(<PrinterConnectionWatcher />)
    act(() => store().disconnect())
    expect(toastMock.error).not.toHaveBeenCalled()
  })
})
