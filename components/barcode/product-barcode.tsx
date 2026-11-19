'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Loader2, Printer, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { BarcodeSvg } from './barcode-svg'
import { LabelPrintDialog, type LabelProduct } from './label-print-dialog'

interface BarcodeOwner {
  barcode: string | null | undefined
  productName: string
  variantName?: string | null
  price: number
}

interface ProductBarcodeProps extends BarcodeOwner {
  canEdit: boolean
  /** Crée le code (POST …/barcode) et le renvoie. */
  generate: () => Promise<string>
  onGenerated?: (code: string) => void
  className?: string
}

function useGenerate(generate: () => Promise<string>, onGenerated?: (code: string) => void) {
  const { t } = useTranslation()
  const [busy, setBusy] = React.useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const code = await generate()
      toast.success(t('barcode.detail.generated', { code }))
      onGenerated?.(code)
    } catch (error) {
      const message = (error as { errors?: Record<string, string[]> } | null)?.errors?.barcode?.[0]
      toast.error(message || t('barcode.detail.generateFailed'))
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

const SECONDARY =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'

/** Fiche produit (article simple) : le code (chiffres + dessin), « Générer » s'il manque, « Imprimer l'étiquette ». */
export function ProductBarcode({ barcode, productName, variantName, price, canEdit, generate, onGenerated, className }: ProductBarcodeProps) {
  const { t } = useTranslation()
  const { busy, run } = useGenerate(generate, onGenerated)
  const [label, setLabel] = React.useState<LabelProduct | null>(null)

  return (
    <section aria-labelledby="product-barcode-title" className={cn('flex flex-col gap-3', className)} data-product-barcode={barcode ? 'set' : 'none'}>
      <h2 id="product-barcode-title" className="text-base font-bold text-ink">
        {t('barcode.detail.title')}
      </h2>
      {barcode ? (
        <>
          <div className="rounded-tile border border-line bg-white p-3">
            <BarcodeSvg value={barcode} barHeight={34} className="mx-auto h-[84px] w-full max-w-[300px]" label={t('barcode.detail.drawingAria', { code: barcode })} />
          </div>
          <button
            type="button"
            onClick={() => setLabel({ productName, variantName, price, barcode })}
            aria-label={t('barcode.detail.printLabelAria', { name: productName })}
            className={cn(SECONDARY, 'self-start')}
          >
            <Printer className="size-4" aria-hidden="true" />
            {t('barcode.detail.printLabel')}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2.5 rounded-tile border border-dashed border-line-strong bg-surface-soft p-3.5">
          <p className="text-sm text-subtle">{t('barcode.detail.none')}</p>
          {canEdit ? (
            <button type="button" onClick={() => void run()} disabled={busy} className={SECONDARY}>
              {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {t('barcode.detail.generate')}
            </button>
          ) : null}
        </div>
      )}
      <LabelPrintDialog open={label !== null} onOpenChange={(open) => !open && setLabel(null)} product={label} />
    </section>
  )
}

interface VariantBarcodeProps extends BarcodeOwner {
  canEdit: boolean
  generate: () => Promise<string>
  onGenerated?: (code: string) => void
  /** Ordinateur : petit dessin du code ; mobile : les chiffres seulement. */
  showDrawing?: boolean
}

/** Ligne de variante : code (dessin + chiffres), « Générer » ou « Imprimer l'étiquette ». */
export function VariantBarcode({ barcode, productName, variantName, price, canEdit, generate, onGenerated, showDrawing = false }: VariantBarcodeProps) {
  const { t } = useTranslation()
  const { busy, run } = useGenerate(generate, onGenerated)
  const [label, setLabel] = React.useState<LabelProduct | null>(null)
  const name = [productName, variantName].filter(Boolean).join(' — ')

  return (
    <span className="inline-flex items-center gap-2" data-variant-barcode={barcode ? 'set' : 'none'}>
      {barcode ? (
        <>
          <span className="flex flex-col items-start gap-0.5">
            {showDrawing ? <BarcodeSvg value={barcode} barHeight={22} showText={false} className="h-7 w-[120px]" /> : null}
            <span className="font-mono text-xs tracking-wide text-ink-2">{barcode}</span>
          </span>
          <button
            type="button"
            onClick={() => setLabel({ productName, variantName, price, barcode })}
            aria-label={t('barcode.detail.printLabelAria', { name })}
            title={t('barcode.detail.printLabel')}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <Printer className="size-4" aria-hidden="true" />
          </button>
        </>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          aria-label={`${t('barcode.detail.generate')} · ${name}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-bold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
          {t('barcode.field.generate')}
        </button>
      ) : (
        <span className="text-xs text-subtle">—</span>
      )}
      <LabelPrintDialog open={label !== null} onOpenChange={(open) => !open && setLabel(null)} product={label} />
    </span>
  )
}
