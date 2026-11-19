'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { countMissingBarcodes, generateMissingBarcodes, type MissingBarcodesScope } from '@/lib/services/barcodes'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface GenerateMissingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent : tout le compte. */
  scope?: MissingBarcodesScope
  onGenerated?: (count: number) => void
}

/**
 * « Générer les codes manquants » : demande d'abord au serveur combien de
 * codes seront créés (dry_run), l'affiche, puis génère après confirmation.
 */
export function GenerateMissingDialog({ open, onOpenChange, scope, onGenerated }: GenerateMissingDialogProps) {
  const { t } = useTranslation()
  const [count, setCount] = React.useState<number | null>(null)
  const [failed, setFailed] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const scopeKey = JSON.stringify(scope ?? {})

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setCount(null)
    setFailed(false)
    countMissingBarcodes(JSON.parse(scopeKey) as MissingBarcodesScope).then(
      (n) => !cancelled && setCount(n),
      () => !cancelled && setFailed(true)
    )
    return () => {
      cancelled = true
    }
  }, [open, scopeKey])

  const generate = async () => {
    setGenerating(true)
    try {
      const created = await generateMissingBarcodes(scope ?? {})
      toast.success(t('barcode.stock.generated', { count: created }))
      onGenerated?.(created)
      onOpenChange(false)
    } catch {
      toast.error(t('barcode.stock.generateFailed'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !generating && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('barcode.stock.confirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription aria-live="polite">
            {failed
              ? t('barcode.stock.generateFailed')
              : count === null
                ? t('barcode.stock.counting')
                : count === 0
                  ? t('barcode.stock.confirmNone')
                  : t('barcode.stock.confirmBody', { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={generating}>{t('common.cancel')}</AlertDialogCancel>
          {count ? (
            <button
              type="button"
              onClick={() => void generate()}
              disabled={generating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-active px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              {generating ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {t('barcode.stock.confirmAction')}
            </button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
