'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft } from 'lucide-react'

import {
  getInvoiceById,
  updateInvoiceStatus,
  duplicateInvoice,
  deleteInvoice,
  getInvoicePdfBlob,
  type Invoice,
  type InvoiceStatus,
} from '@/lib/services/invoices'
import { invalidateInvoices } from '@/lib/invalidate'
import { getInvoiceStatusDisplay } from '@/components/invoices/invoice-status'
import { InvoicePreviewCard } from '@/components/invoices/invoice-preview-card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, StatusBadge } from '@/components/waelly'

/**
 * Détail d'une facture — même carte que le panneau "Aperçu" de /invoices
 * (design/maquettes/ordinateur/Web-Factures.dc.html), affichée en pleine
 * page. Sert la navigation mobile (Factures.dc.html : le tap sur une
 * facture ouvre cette page) et l'accès direct par URL sur toute taille
 * d'écran.
 */
export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = React.useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [statusChanging, setStatusChanging] = React.useState(false)
  const [duplicating, setDuplicating] = React.useState(false)
  const [generatingPdf, setGeneratingPdf] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const fetchInvoice = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getInvoiceById(invoiceId)
      if (data) setInvoice(data)
      else setError('Facture introuvable.')
    } catch (err: unknown) {
      setError((err as Error).message || 'Impossible de charger la facture.')
    } finally {
      setIsLoading(false)
    }
  }, [invoiceId])

  React.useEffect(() => {
    fetchInvoice()
  }, [fetchInvoice])

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return
    const previous = invoice
    setStatusChanging(true)
    setInvoice({ ...previous, status: newStatus })
    try {
      const updated = await updateInvoiceStatus(previous.id, newStatus)
      setInvoice(updated)
      invalidateInvoices({ paid: newStatus === 'paid' })
      toast.success(newStatus === 'paid' ? 'Facture marquée comme payée' : 'Facture envoyée')
    } catch (err: unknown) {
      setInvoice(previous)
      const apiError = err as { status?: number; errors?: unknown; message?: string }
      if (apiError.status === 422 && Array.isArray(apiError.errors) && apiError.errors.length > 0) {
        apiError.errors.forEach((message) => toast.error(String(message)))
      } else {
        toast.error(apiError.message || 'Échec de la mise à jour du statut')
      }
    } finally {
      setStatusChanging(false)
    }
  }

  const handleDuplicate = async () => {
    if (!invoice) return
    setDuplicating(true)
    try {
      const copy = await duplicateInvoice(invoice.id)
      invalidateInvoices()
      toast.success('Facture dupliquée')
      router.push(`/invoices/${copy.id}`)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Échec de la duplication')
    } finally {
      setDuplicating(false)
    }
  }

  const handleDeleteInvoice = async () => {
    if (!invoice) return
    setDeleting(true)
    try {
      const result = await deleteInvoice(invoice.id)
      if (result.success) {
        invalidateInvoices()
        toast.success('Facture supprimée')
        router.push('/invoices')
      } else {
        toast.error(result.message)
        setDeleting(false)
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Échec de la suppression')
      setDeleting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!invoice) return
    setGeneratingPdf(true)
    try {
      const blob = await getInvoicePdfBlob(invoice.id, 'download')
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Facture-${invoice.invoice_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Échec de la génération du PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-soft" />
        <div className="h-[480px] max-w-xl animate-pulse rounded-[20px] bg-surface-soft" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-12 text-subtle" />
        <p className="text-sm text-subtle">{error || 'Facture introuvable.'}</p>
        <Button variant="secondary" onClick={fetchInvoice}>
          Réessayer
        </Button>
      </div>
    )
  }

  const statusDisplay = getInvoiceStatusDisplay(invoice)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 pb-28 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/invoices"
          aria-label="Retour aux factures"
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <StatusBadge
          tone={statusDisplay.tone}
          label={statusDisplay.label}
          className={statusDisplay.strikethrough ? 'line-through' : ''}
        />
      </div>

      <InvoicePreviewCard invoice={invoice} />

      <div
        className={`grid gap-2 ${invoice.status === 'paid' || invoice.status === 'cancelled' ? 'grid-cols-2' : 'grid-cols-3'}`}
      >
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={generatingPdf}
          className="flex min-h-[48px] items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-bold text-ink disabled:opacity-60"
        >
          {generatingPdf ? '…' : 'PDF'}
        </button>
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={duplicating}
          className="flex min-h-[48px] items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-bold text-ink disabled:opacity-60"
        >
          {duplicating ? '…' : 'Dupliquer'}
        </button>
        {invoice.status === 'draft' ? (
          <button
            type="button"
            onClick={() => handleStatusChange('unpaid')}
            disabled={statusChanging}
            className="flex min-h-[48px] items-center justify-center rounded-full bg-active text-sm font-bold text-white disabled:opacity-60"
          >
            {statusChanging ? '…' : 'Envoyer'}
          </button>
        ) : invoice.status === 'paid' || invoice.status === 'cancelled' ? null : (
          <button
            type="button"
            onClick={() => handleStatusChange('paid')}
            disabled={statusChanging}
            className="flex min-h-[48px] items-center justify-center rounded-full bg-active text-sm font-bold text-white disabled:opacity-60"
          >
            {statusChanging ? '…' : 'Marquer payée'}
          </button>
        )}
      </div>

      {invoice.status !== 'paid' ? (
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="self-start text-[13px] font-semibold text-danger-strong"
        >
          Supprimer la facture
        </button>
      ) : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture {invoice.invoice_number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Les factures payées ne peuvent pas être supprimées — annulez-les à la
              place.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
