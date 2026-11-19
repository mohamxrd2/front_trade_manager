'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, Printer, Share2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatMoney } from '@/lib/i18n/format'
import { useCurrency } from '@/lib/utils/currency'
import { keys } from '@/lib/query-keys'
import { getReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/lib/services/receipt-settings'
import { useBluetoothPrinterStore } from '@/lib/stores/bluetooth-printer'
import { getPlatformInfo, isShareOnlyPlatform, type PlatformInfo } from '@/lib/receipt/platform'
import { readCutPaper, readLabelBarcodeMode, readPrinterCharset } from '@/lib/receipt/printer-preferences'
import { printerDotsFor } from '@/lib/receipt/escpos/raster'
import { dataUrlToFile, downloadDataUrl, renderThermalReceiptPng } from '@/lib/receipt/share-receipt'
import { shareFileNow } from '@/lib/receipt/ios-share'
import { encodeLabelEscPosBlocks, MAX_LABEL_COPIES } from '@/lib/barcode/label-escpos'
import { PrinterStatus } from '@/components/printer/printer-status'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BarcodeSvg } from './barcode-svg'

export interface LabelProduct {
  productName: string
  variantName?: string | null
  price: number
  barcode: string
}

interface LabelPrintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: LabelProduct | null
}

/** Largeur d'affichage de l'aperçu (≈ largeur imprimable du papier). */
const PREVIEW_WIDTH = { '58mm': 'w-[220px]', '80mm': 'w-[300px]' } as const

/**
 * Étiquette produit : aperçu, nombre d'exemplaires, impression Bluetooth
 * (ESC/POS) — ou partage de l'étiquette en image quand le navigateur ne
 * parle pas à l'imprimante (iPhone).
 */
export function LabelPrintDialog({ open, onOpenChange, product }: LabelPrintDialogProps) {
  const { t, language } = useTranslation()
  const { currency } = useCurrency()
  const status = useBluetoothPrinterStore((s) => s.status)
  const print = useBluetoothPrinterStore((s) => s.print)
  const init = useBluetoothPrinterStore((s) => s.init)
  const previewRef = React.useRef<HTMLDivElement>(null)

  const [platform, setPlatform] = React.useState<PlatformInfo | null>(null)
  const [copies, setCopies] = React.useState(1)
  const [printing, setPrinting] = React.useState(false)
  const [prepared, setPrepared] = React.useState<{ dataUrl: string; file: File } | null>(null)
  const [fallbackImage, setFallbackImage] = React.useState<string | null>(null)

  const { data: receiptSettings } = useQuery({
    queryKey: keys.settings.receipt(),
    queryFn: getReceiptSettings,
    staleTime: 10 * 60 * 1000,
  })
  const width = (receiptSettings ?? DEFAULT_RECEIPT_SETTINGS).width
  const priceText = product ? formatMoney(product.price, currency, language) : ''
  const filename = product ? `etiquette-${product.barcode}.png` : 'etiquette.png' // i18n:allow — nom de fichier, pas un texte affiché

  React.useEffect(() => {
    if (!open) {
      setCopies(1)
      setPrepared(null)
      setFallbackImage(null)
      return
    }
    setPlatform(getPlatformInfo())
    void init()
  }, [open, init])

  const shareOnly = platform !== null && (isShareOnlyPlatform(platform) || !platform.bluetooth)
  const connected = status === 'connected'

  // Partage : image préparée À L'AVANCE — Safari n'ouvre la feuille de partage que pendant le geste.
  React.useEffect(() => {
    if (!open || !product || platform === null) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      if (!previewRef.current) return
      try {
        const dataUrl = await renderThermalReceiptPng(previewRef.current, printerDotsFor(width))
        if (!cancelled) setPrepared({ dataUrl, file: dataUrlToFile(dataUrl, filename) })
      } catch {
        // Le bouton reste utilisable : l'image sera faite au clic (hors iPhone).
      }
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, product, platform, width, priceText, filename])

  const handlePrint = async () => {
    if (!product) return
    setPrinting(true)
    try {
      const blocks = encodeLabelEscPosBlocks(
        { productName: product.productName, variantName: product.variantName, price: priceText, barcode: product.barcode },
        { width, copies, charset: readPrinterCharset(), cutPaper: readCutPaper(), barcodeMode: readLabelBarcodeMode() }
      )
      const result = await print(blocks)
      if (result.ok) {
        toast.success(t('barcode.label.printed', { count: copies }))
        onOpenChange(false)
      } else {
        toast.error(t('barcode.label.printFailed'))
      }
    } finally {
      setPrinting(false)
    }
  }

  const handleShare = async () => {
    let ready = prepared
    if (!ready) {
      if (!previewRef.current) return
      try {
        const dataUrl = await renderThermalReceiptPng(previewRef.current, printerDotsFor(width))
        ready = { dataUrl, file: dataUrlToFile(dataUrl, filename) }
        setPrepared(ready)
      } catch {
        toast.error(t('barcode.label.shareFailed'))
        return
      }
    }
    const outcome = await shareFileNow(ready.file, t('barcode.label.fallbackTitle'))
    if (outcome === 'retry') toast(t('barcode.label.shareRetry'))
    if (outcome === 'fallback') {
      if (platform?.ios) {
        setFallbackImage(ready.dataUrl)
      } else {
        downloadDataUrl(ready.dataUrl, filename)
        toast.success(t('barcode.label.downloaded'))
      }
    }
  }

  const stepper = (
    <div className="flex items-center justify-between gap-3 rounded-tile border border-line bg-surface p-3">
      <span id="label-copies-label" className="text-sm font-semibold text-ink">
        {t('barcode.label.copies')}
      </span>
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={t('barcode.label.copiesDecrease')}
          onClick={() => setCopies((n) => Math.max(1, n - 1))}
          disabled={copies <= 1}
          className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-canvas text-ink disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <input
          type="number"
          min={1}
          max={MAX_LABEL_COPIES}
          inputMode="numeric"
          aria-labelledby="label-copies-label"
          value={copies}
          onChange={(e) => setCopies(Math.max(1, Math.min(MAX_LABEL_COPIES, parseInt(e.target.value, 10) || 1)))}
          className="h-11 w-14 rounded-lg border border-line-strong bg-surface text-center text-lg font-extrabold text-ink outline-none focus:border-brand-500"
        />
        <button
          type="button"
          aria-label={t('barcode.label.copiesIncrease')}
          onClick={() => setCopies((n) => Math.min(MAX_LABEL_COPIES, n + 1))}
          disabled={copies >= MAX_LABEL_COPIES}
          className="flex size-11 items-center justify-center rounded-full bg-brand-500 text-white disabled:opacity-40"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </span>
    </div>
  )

  const shareButton = (primary: boolean) => (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        primary ? 'bg-active text-white hover:opacity-90' : 'border border-line-strong bg-surface text-ink hover:bg-surface-soft'
      )}
    >
      <Share2 className="size-4" aria-hidden="true" />
      {t('barcode.label.share')}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('barcode.label.title')}</DialogTitle>
          <DialogDescription>{product ? [product.productName, product.variantName].filter(Boolean).join(' — ') : ''}</DialogDescription>
        </DialogHeader>

        {product ? (
          <div className="flex flex-col gap-4">
            {/* --- Aperçu (aussi la source de l'image partagée) --- */}
            <section aria-label={t('barcode.label.preview')} className="flex flex-col items-center gap-2 rounded-tile bg-surface-soft p-4">
              <span className="self-start text-xs font-semibold uppercase tracking-wide text-subtle">
                {t('barcode.label.preview')} · {t('barcode.label.paper', { width: width === '80mm' ? '80 mm' : '58 mm' })}
              </span>
              {fallbackImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- image générée localement (data:) */}
                  <img src={fallbackImage} alt={t('barcode.label.fallbackTitle')} className={cn(PREVIEW_WIDTH[width], 'border border-line bg-white')} />
                  <p className="text-center text-[13px] text-subtle">{t('barcode.label.fallbackHint')}</p>
                </>
              ) : (
                <div
                  ref={previewRef}
                  data-label-preview
                  className={cn(PREVIEW_WIDTH[width], 'flex flex-col items-center gap-1 bg-white px-2 py-3 text-center text-black shadow-card')}
                >
                  <span className="w-full break-words text-[14px] font-bold leading-tight">{product.productName}</span>
                  {product.variantName ? <span className="w-full break-words text-[13px] leading-tight">{product.variantName}</span> : null}
                  <span className="text-[20px] font-extrabold leading-tight">{priceText}</span>
                  <BarcodeSvg value={product.barcode} barHeight={36} className="mt-1 w-full" label={t('barcode.detail.drawingAria', { code: product.barcode })} />
                </div>
              )}
            </section>

            {stepper}

            {shareOnly ? (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] leading-relaxed text-subtle">{t('barcode.label.shareHelp')}</p>
                {shareButton(true)}
              </div>
            ) : connected ? (
              <button
                type="button"
                onClick={() => void handlePrint()}
                disabled={printing}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-active px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                {printing ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Printer className="size-4" aria-hidden="true" />}
                {printing ? t('barcode.label.printing') : t('barcode.label.print', { count: copies })}
              </button>
            ) : (
              <div className="flex flex-col gap-3 rounded-tile border border-line bg-surface p-3.5" data-label-printer="disconnected">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-bold text-ink">{t('barcode.label.notConnected')}</p>
                  <p className="text-[13px] text-subtle">{t('barcode.label.notConnectedBody')}</p>
                </div>
                <PrinterStatus className="self-start" />
                {shareButton(false)}
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
