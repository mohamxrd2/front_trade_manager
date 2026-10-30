'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Printer, Share2 } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useSettings } from '@/contexts/SettingsContext'
import { getCompany } from '@/lib/services/company'
import { getReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/lib/services/receipt-settings'
import { keys } from '@/lib/query-keys'
import { paymentMethodLabelKey } from '@/lib/transactions/transaction-visual'
import type { Operation } from '@/lib/services/operations'
import {
  buildReceipt,
  type ReceiptCompanyInfo,
  type ReceiptDisplaySettings,
  type ReceiptLabels,
  type ReceiptOperationInput,
} from '@/lib/receipt/build-receipt'
import { generateReceiptQrDataUrl } from '@/lib/receipt/qr'
import { printReceiptModel } from '@/lib/receipt/print-receipt'
import { shareReceiptImage } from '@/lib/receipt/share-receipt'
import { encodeReceiptEscPosBlocks } from '@/lib/receipt/escpos-encoder'
import { printerDotsFor } from '@/lib/receipt/escpos/raster'
import { loadLogoImageData } from '@/lib/receipt/load-logo-canvas'
import { useBluetoothPrinterStore } from '@/lib/stores/bluetooth-printer'
import { readDefaultPrintMode, readCutPaper, readPrintLogo, readPrintQr, readPrinterCharset, readAutoPrintPreference, resolveAutoPrint } from '@/lib/receipt/printer-preferences'
import { useAuth } from '@/contexts/AuthContext'
import { ReceiptView } from './receipt-view'
import { Button } from './button'

export interface ReceiptActionsProps {
  operation: Operation
  /** Réimpression (détail d'une transaction) — affiche "DUPLICATA" sous le numéro. */
  duplicate?: boolean
  /** Uniquement l'écran de confirmation juste après une vente — déclenche l'impression automatique si le réglage est actif. */
  autoPrintOnSuccess?: boolean
  /** Replié par défaut sur l'écran de confirmation ; ouvert d'emblée dans le détail d'une transaction (moins de contexte au-dessus). */
  defaultOpen?: boolean
}

/**
 * Aperçu + actions du ticket de caisse (Imprimer/Partager) — un seul
 * endroit pour construire le modèle (buildReceipt) et piloter
 * impression/partage, réutilisé par l'écran de confirmation de vente ET le
 * détail d'une transaction (réimpression), voir le besoin produit.
 */
function ReceiptActions({ operation, duplicate = false, autoPrintOnSuccess = false, defaultOpen = false }: ReceiptActionsProps) {
  const { t, language } = useTranslation()
  const { settings: userSettings } = useSettings()
  const { user } = useAuth()
  const [open, setOpen] = React.useState(defaultOpen)
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const [sharing, setSharing] = React.useState(false)
  const previewRef = React.useRef<HTMLDivElement>(null)
  const autoPrintedRef = React.useRef(false)

  const { data: company } = useQuery({
    queryKey: keys.settings.company(),
    queryFn: getCompany,
    staleTime: 30 * 60 * 1000,
  })
  const { data: receiptSettings } = useQuery({
    queryKey: keys.settings.receipt(),
    queryFn: getReceiptSettings,
    staleTime: 10 * 60 * 1000,
  })

  const apiSettings = receiptSettings ?? DEFAULT_RECEIPT_SETTINGS
  const settings: ReceiptDisplaySettings = {
    width: apiSettings.width,
    showLogo: apiSettings.show_logo,
    showAddress: apiSettings.show_address,
    showPhone: apiSettings.show_phone,
    showTaxId: apiSettings.show_tax_id,
    footerMessage: apiSettings.footer_message,
    showQr: apiSettings.show_qr,
    showWaellyMention: apiSettings.show_waelly_mention,
  }

  // Nom de l'entreprise vide : nom du compte, puis la marque en dernier recours.
  const accountName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim()
  const receiptCompany: ReceiptCompanyInfo = {
    name: company?.name || accountName || 'Waelly', // i18n:allow — nom de secours uniquement si ni l'entreprise ni le compte n'ont de nom
    logoUrl: company?.logo_url ?? null,
    address: company?.headquarters ?? null,
    phone: company?.phone ?? null,
    taxId: company?.tax_id ?? null,
  }

  const paymentMethodLabel = operation.paymentMethod
    ? (() => {
        const key = paymentMethodLabelKey(operation.paymentMethod)
        return key ? t(key) : null
      })()
    : null

  const isCash = operation.paymentMethod === 'especes'
  const receiptOperation: ReceiptOperationInput = {
    code: operation.code,
    date: operation.date,
    paymentMethodLabel,
    totalAmount: operation.totalAmount,
    amountReceived: isCash ? operation.amountReceived : null,
    changeGiven: isCash ? operation.changeGiven : null,
    clientName: operation.clientName,
    authorName: operation.authorName,
    lines: operation.lines.map((line) => ({
      name: line.articleName || line.name,
      variationName: line.variationName,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    })),
  }

  const labels: ReceiptLabels = {
    ticketNumber: t('wallet.receipt.ticketNumber'),
    cashier: t('wallet.receipt.cashier'),
    client: t('wallet.checkout.clientLabel'),
    total: t('wallet.receipt.total'),
    paidBy: t('wallet.receipt.paidBy'),
    received: t('wallet.receipt.received'),
    changeGiven: t('wallet.checkout.changeLabel'),
    duplicate: t('wallet.receipt.duplicate'),
    paymentMethodUnknown: t('wallet.detail.paymentMethodUnknown'),
    defaultFooter: t('wallet.receipt.defaultFooter'),
    waellyMention: 'Waelly', // i18n:allow — nom de marque, jamais traduit
  }

  const model = React.useMemo(
    () =>
      buildReceipt(receiptOperation, receiptCompany, settings, {
        language,
        currency: userSettings?.currency,
        duplicate,
        labels,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operation.id, settings, company, language, userSettings?.currency, duplicate]
  )

  React.useEffect(() => {
    if (!settings.showQr) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    generateReceiptQrDataUrl(operation.code).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [operation.code, settings.showQr])

  const bluetoothStatus = useBluetoothPrinterStore((s) => s.status)
  const bluetoothInit = useBluetoothPrinterStore((s) => s.init)
  const bluetoothReconnect = useBluetoothPrinterStore((s) => s.reconnect)
  const bluetoothPrint = useBluetoothPrinterStore((s) => s.print)

  React.useEffect(() => {
    bluetoothInit()
  }, [bluetoothInit])

  const printClassic = React.useCallback(() => {
    const started = printReceiptModel(model, qrDataUrl)
    if (!started) {
      toast.error(t('wallet.receipt.printFailed'))
    }
  }, [model, qrDataUrl, t])

  const showDisconnectedToast = React.useCallback(() => {
    toast.error(t('wallet.receipt.bluetoothPrinterDisconnected'), {
      action: {
        label: t('settings.receipt.bluetoothReconnectButton'),
        onClick: () => {
          bluetoothReconnect().catch(() => toast.error(t('settings.receipt.bluetoothConnectFailed')))
        },
      },
      cancel: {
        label: t('wallet.receipt.printClassicAction'),
        onClick: printClassic,
      },
    })
  }, [t, bluetoothReconnect, printClassic])

  const printBluetooth = React.useCallback(async (): Promise<boolean> => {
    try {
      // Logo et QR : seulement si activés pour l'imprimante (désactivés par
      // défaut, commandes d'image pas toujours comprises) ET sur le ticket.
      const printLogo = readPrintLogo() && settings.showLogo && !!receiptCompany.logoUrl
      const logoImage =
        printLogo && receiptCompany.logoUrl
          ? await loadLogoImageData(receiptCompany.logoUrl, Math.round(printerDotsFor(model.width) * 0.6), 160)
          : null
      const blocks = encodeReceiptEscPosBlocks(model, {
        charset: readPrinterCharset(),
        cutPaper: readCutPaper(),
        printLogo,
        logoImage,
        printQr: readPrintQr() && settings.showQr,
        companyNameFallback: receiptCompany.name,
      })
      const result = await bluetoothPrint(blocks)
      return result.ok
    } catch {
      // Un échec d'impression ne doit jamais remonter plus haut — la vente
      // reste enregistrée dans tous les cas, voir handlePrint ci-dessous.
      return false
    }
  }, [model, settings.showLogo, settings.showQr, receiptCompany.logoUrl, receiptCompany.name, bluetoothPrint])

  const handlePrint = React.useCallback(async () => {
    const mode = readDefaultPrintMode()
    if (mode === 'classic') {
      printClassic()
      return
    }
    if (bluetoothStatus !== 'connected') {
      showDisconnectedToast()
      return
    }
    const ok = await printBluetooth()
    if (ok) {
      toast.success(t('wallet.receipt.printed'))
    } else {
      showDisconnectedToast()
    }
  }, [bluetoothStatus, printBluetooth, printClassic, showDisconnectedToast, t])

  React.useEffect(() => {
    if (!autoPrintOnSuccess || autoPrintedRef.current) return
    // Choix de cet appareil (réglable par le caissier) sinon réglage de
    // l'entreprise — on attend ce dernier seulement s'il est nécessaire.
    const devicePreference = readAutoPrintPreference()
    if (devicePreference === null && receiptSettings === undefined) return
    if (!resolveAutoPrint(devicePreference, receiptSettings?.auto_print)) return
    autoPrintedRef.current = true
    handlePrint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrintOnSuccess, receiptSettings])

  const handleShare = async () => {
    if (!previewRef.current) return
    setSharing(true)
    try {
      const result = await shareReceiptImage(previewRef.current, operation.code, t('wallet.receipt.shareTitle'))
      // 'shared' : l'OS affiche déjà son propre retour (feuille de partage). 'cancelled' : fermée par
      // l'utilisateur lui-même, rien à dire. 'downloaded' : repli silencieux sinon — sans ce toast, rien
      // ne semble se produire (la plupart des navigateurs ordinateur ne supportent pas le partage de fichiers).
      if (result.outcome === 'downloaded') {
        toast.success(t('wallet.receipt.downloaded'))
      }
    } catch {
      toast.error(t('wallet.receipt.shareFailed'))
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 items-center justify-between rounded-tile border border-line-strong bg-surface px-4 text-sm font-semibold text-ink"
      >
        {t('wallet.receipt.previewToggle')}
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div
        style={{ maxHeight: open ? 2000 : 0, overflow: 'hidden', transition: 'max-height 200ms ease' }}
        className={open ? 'rounded-tile border border-line bg-surface p-4' : ''}
      >
        <div ref={previewRef} className="bg-white p-3">
          <ReceiptView model={model} qrDataUrl={qrDataUrl} />
        </div>
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:flex-row">
        <Button variant="secondary" className="h-12 min-h-11 flex-1 rounded-full" onClick={handlePrint}>
          <Printer className="size-4" />
          {t('wallet.receipt.printButton')}
        </Button>
        <Button variant="secondary" className="h-12 min-h-11 flex-1 rounded-full" onClick={handleShare} disabled={sharing}>
          <Share2 className="size-4" />
          {sharing ? t('wallet.receipt.sharing') : t('wallet.receipt.shareButton')}
        </Button>
      </div>

      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={() => setHelpOpen((v) => !v)} className="text-xs font-semibold text-brand-600">
          {t('wallet.receipt.printerHelpLink')}
        </button>
        {helpOpen ? <p className="text-xs text-subtle">{t('wallet.receipt.printerHelpText')}</p> : null}
      </div>
    </div>
  )
}

export { ReceiptActions }
