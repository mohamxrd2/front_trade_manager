'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Loader2, Printer, Share2 } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { dataUrlToFile, renderThermalReceiptPng } from '@/lib/receipt/share-receipt'
import { shareFileNow } from '@/lib/receipt/ios-share'
import { printReceiptImage } from '@/lib/receipt/print-image'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from './button'

interface IosReceiptShareProps {
  /** Le ticket affiché (aperçu) — l'image en est tirée. */
  nodeRef: React.RefObject<HTMLElement | null>
  /** Change quand le ticket change : l'image est alors préparée à nouveau. */
  renderKey: string
  code: string
  widthMm: 58 | 80
  /** « Impression AirPrint » en secondaire (Safari seulement, jamais en mode écran d'accueil). */
  showAirPrint?: boolean
  /** Libellé du bouton principal (par défaut « Partager / Imprimer le ticket »). */
  label?: string
}

/**
 * Partage du ticket sur iPhone/iPad. L'image est préparée DÈS que le ticket
 * est affiché ; au toucher, navigator.share est appelé immédiatement (Safari
 * refuse s'il y a une attente avant — voir lib/receipt/ios-share.ts).
 * Refus de Safari → « Touchez à nouveau pour partager » ; partage impossible
 * → l'image en plein écran dans l'app (appui long → Partager/Enregistrer).
 */
function IosReceiptShare({ nodeRef, renderKey, code, widthMm, showAirPrint = false, label }: IosReceiptShareProps) {
  const { t } = useTranslation()
  const [status, setStatus] = React.useState<'preparing' | 'ready' | 'error'>('preparing')
  const [dataUrl, setDataUrl] = React.useState<string | null>(null)
  const [retry, setRetry] = React.useState(false)
  const [imageOpen, setImageOpen] = React.useState(false)
  const fileRef = React.useRef<File | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setStatus('preparing')
    setRetry(false)
    // Court délai : laisse le ticket (polices, QR) s'afficher avant le rendu.
    const timer = setTimeout(async () => {
      const node = nodeRef.current
      if (!node) return
      try {
        const url = await renderThermalReceiptPng(node, widthMm === 80 ? 576 : 384)
        if (cancelled) return
        fileRef.current = dataUrlToFile(url, `ticket-${code}.png`)
        setDataUrl(url)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [nodeRef, renderKey, code, widthMm])

  const handleShare = () => {
    const file = fileRef.current
    if (!file) return
    // AUCUN await avant cet appel : il doit avoir lieu dans le geste.
    void shareFileNow(file, t('wallet.receipt.shareTitle')).then((outcome) => {
      setRetry(outcome === 'retry')
      if (outcome === 'fallback') setImageOpen(true)
    })
  }

  const handleAirPrint = () => {
    if (!dataUrl || !printReceiptImage(dataUrl, widthMm)) toast.error(t('wallet.receipt.printFailed'))
  }

  return (
    <div className="flex w-full flex-col gap-2.5">
      <Button
        variant="primary"
        className="h-12 min-h-11 w-full rounded-full"
        onClick={status === 'error' ? () => toast.error(t('wallet.receipt.shareFailed')) : handleShare}
        disabled={status === 'preparing'}
      >
        {status === 'preparing' ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        {status === 'preparing'
          ? t('wallet.receipt.preparing')
          : retry
            ? t('wallet.receipt.retryShare')
            : (label ?? t('wallet.receipt.iosShareButton'))}
      </Button>
      {showAirPrint ? (
        <Button variant="secondary" className="h-11 w-full rounded-full" onClick={handleAirPrint} disabled={status !== 'ready'}>
          <Printer className="size-4" />
          {t('wallet.receipt.airPrintButton')}
        </Button>
      ) : null}

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-base font-bold text-ink">{t('wallet.receipt.imageModalHint')}</DialogTitle>
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={t('wallet.receipt.shareTitle')} className="mx-auto w-full max-w-[320px]" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { IosReceiptShare }
