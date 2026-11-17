'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { ChevronDown, Info, Loader2, Printer, PrinterCheck, Share2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { isWebBluetoothSupported } from '@/lib/receipt/bluetooth-transport'
import { useBluetoothPrinterStore } from '@/lib/stores/bluetooth-printer'
import { usePrintTestTicket } from '@/hooks/usePrintTestTicket'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type PrinterIndicatorState = 'connected' | 'connecting' | 'disconnected' | 'share'

const PILL = 'flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-ink shadow-card'

function Dot({ state, pulseKey }: { state: Exclude<PrinterIndicatorState, 'share'>; pulseKey?: number }) {
  return (
    <span
      key={pulseKey}
      aria-hidden="true"
      data-state={state}
      className={cn(
        'size-2.5 shrink-0 rounded-full',
        state === 'connected' && 'bg-success',
        state === 'connecting' && 'bg-amber-500 motion-safe:animate-pulse',
        state === 'disconnected' && 'bg-danger-dot',
        state === 'connected' && pulseKey ? 'printer-pulse' : null
      )}
    />
  )
}

/**
 * Imprimante de tickets, d'un coup d'œil (Nouvelle vente) : vert + nom,
 * orange pendant la connexion, rouge + « Connecter » sinon ; « Impression via
 * partage » sur un navigateur sans Web Bluetooth (iPhone, Safari, Firefox).
 * Même état que les Paramètres (useBluetoothPrinterStore) : connecter d'un
 * côté met l'autre au vert. Nom long tronqué ; complet dans le menu.
 */
export function PrinterStatus({ className }: { className?: string }) {
  const { t } = useTranslation()
  const status = useBluetoothPrinterStore((s) => s.status)
  const deviceName = useBluetoothPrinterStore((s) => s.deviceName)
  const connect = useBluetoothPrinterStore((s) => s.connect)
  const disconnect = useBluetoothPrinterStore((s) => s.disconnect)
  const init = useBluetoothPrinterStore((s) => s.init)
  const printTestTicket = usePrintTestTicket()
  const [testPrinting, setTestPrinting] = React.useState(false)

  // Rendu serveur : support inconnu → rien jusqu'au montage (pas de faux bouton).
  const [supported, setSupported] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    setSupported(isWebBluetoothSupported())
    void init()
  }, [init])

  // Le point vert pulse une fois quand la connexion réussit (pas à l'arrivée sur la page déjà connecté).
  const previousStatus = React.useRef(status)
  const [pulseKey, setPulseKey] = React.useState(0)
  React.useEffect(() => {
    if (status === 'connected' && previousStatus.current !== 'connected') setPulseKey((n) => n + 1)
    previousStatus.current = status
  }, [status])

  if (supported === null) return null

  const state: PrinterIndicatorState =
    !supported || status === 'unsupported'
      ? 'share'
      : status === 'connected'
        ? 'connected'
        : status === 'connecting'
          ? 'connecting'
          : 'disconnected'

  const label =
    state === 'connected'
      ? deviceName
        ? t('wallet.printerStatus.connected', { name: deviceName })
        : t('wallet.printerStatus.connectedNoName')
      : state === 'connecting'
        ? t('wallet.printerStatus.connecting')
        : state === 'disconnected'
          ? t('wallet.printerStatus.none')
          : t('wallet.printerStatus.shareMode')

  // Aucun await avant connect() : la fenêtre Bluetooth exige le clic de l'utilisateur.
  const handleConnect = () => {
    connect().catch(() => toast.error(t('wallet.printerStatus.connectFailed')))
  }

  const handleTestPrint = async () => {
    setTestPrinting(true)
    try {
      const result = await printTestTicket()
      if (result.ok) toast.success(t('wallet.printerStatus.testPrinted'))
      else toast.error(t('wallet.printerStatus.testFailed'))
    } finally {
      setTestPrinting(false)
    }
  }

  const liveRegion = (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  )

  if (state === 'share') {
    return (
      <div data-printer-state={state} className={className}>
        {liveRegion}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${label} · ${t('wallet.printerStatus.shareHelpAria')}`} className={cn(PILL, 'text-ink-2')}>
              <Share2 className="size-4 shrink-0" aria-hidden="true" />
              <span aria-hidden="true" className="whitespace-nowrap">
                {label}
              </span>
              <Info className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 text-[13px] leading-relaxed text-ink-2">
            <p className="mb-1 font-semibold text-ink">{label}</p>
            {t('wallet.printerStatus.shareHelp')}
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  if (state === 'connected') {
    return (
      <div data-printer-state={state} className={className}>
        {liveRegion}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={t('wallet.printerStatus.menuAria', { name: deviceName ?? '' })} className={PILL}>
              <Dot state="connected" pulseKey={pulseKey} />
              <PrinterCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
              <span aria-hidden="true" className="max-w-[14rem] truncate sm:max-w-[16rem]">
                {label}
              </span>
              <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-subtle">{t('wallet.printerStatus.menuLabel')}</span>
              {deviceName ? <span className="truncate text-sm font-bold text-ink">{deviceName}</span> : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={testPrinting} onSelect={() => void handleTestPrint()} className="min-h-11">
              {t('wallet.printerStatus.testPrint')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleConnect} className="min-h-11">
              {t('wallet.printerStatus.change')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={disconnect} className="min-h-11 text-danger-strong">
              {t('wallet.printerStatus.disconnect')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  if (state === 'connecting') {
    return (
      <div data-printer-state={state} className={cn(PILL, className)}>
        {liveRegion}
        <Dot state="connecting" />
        <Loader2 className="size-4 shrink-0 animate-spin text-ink-3 motion-reduce:animate-none" aria-hidden="true" />
        <span aria-hidden="true" className="whitespace-nowrap">
          {label}
        </span>
      </div>
    )
  }

  return (
    <div data-printer-state={state} className={cn(PILL, 'pr-1.5', className)}>
      {liveRegion}
      <Dot state="disconnected" />
      <Printer className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span aria-hidden="true" className="whitespace-nowrap">
        {label}
      </span>
      <button
        type="button"
        onClick={handleConnect}
        aria-label={t('wallet.printerStatus.connectAria')}
        className="ml-0.5 inline-flex h-8 items-center rounded-full bg-active px-3 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        {t('wallet.printerStatus.connect')}
      </button>
    </div>
  )
}
