'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import 'dayjs/locale/en'
import {
  ArrowLeft,
  Download,
  Eye,
  Printer,
  FileText,
  Building2,
  User,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InvoiceStatusBadge } from '@/components/invoices'
import { DeleteInvoiceButton } from '@/components/invoices/delete-invoice-button'
import { getInvoiceById, updateInvoiceStatus, getInvoicePdfBlob, type Invoice, type InvoiceStatus } from '@/lib/services/invoices'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t, language } = useTranslation()
  const { currency } = useCurrency()

  // Les dates (dayjs.locale mute l'instance globale) suivent la langue active
  // au lieu d'être figées en français, sinon les mois/jours restent en FR
  // même quand l'écran est affiché en anglais.
  dayjs.locale(language)

  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<InvoiceStatus | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // Aperçu PDF (généré côté backend)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Fallback si le logo entreprise ne charge pas (fichier manquant, URL cassée...)
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)

  // Format currency from string
  const formatAmount = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const fetchInvoice = useCallback(async (isMounted: () => boolean = () => true) => {
    if (!invoiceId) {
      setIsLoading(false)
      setError(t('invoices.missingId'))
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const data = await getInvoiceById(invoiceId)

      if (!isMounted()) return

      if (data) {
        setInvoice(data)
      } else {
        setError(t('invoices.notFound'))
      }
    } catch (err: unknown) {
      if (!isMounted()) return
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      setError(error.response?.data?.message || error.message || t('invoices.loadError'))
    } finally {
      if (isMounted()) setIsLoading(false)
    }
    // `t` volontairement absent des deps : useTranslation() ne le mémoïse pas,
    // l'ajouter recréerait fetchInvoice à chaque render et boucleraît le fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  useEffect(() => {
    let mounted = true
    fetchInvoice(() => mounted)

    return () => {
      mounted = false
    }
  }, [fetchInvoice])

  // Changement de statut
  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return

    setIsUpdating(true)
    try {
      const updated = await updateInvoiceStatus(invoice.id, newStatus)
      setInvoice(updated)
      toast.success(t('invoices.statusUpdated'))
    } catch (err: unknown) {
      // updateInvoiceStatus() rethrow l'erreur telle que produite par
      // l'intercepteur de réponse de lib/api.ts, qui la remplace toujours
      // par un ApiError "à plat" (status/code/data/errors) — cet objet n'a
      // PAS de propriété `.response` (ce n'est plus l'AxiosError d'origine).
      const error = err as { status?: number; errors?: unknown; message?: string }

      // Passage à "payée" : le backend vérifie le stock disponible pour
      // chaque article de la facture AVANT de créer les transactions de
      // vente (voir InvoiceController::createSaleTransactionsForInvoice) et
      // renvoie un 422 avec un détail par article dans `errors` (ex: "Stock
      // insuffisant pour "Produit X". Disponible: 3, Demandé: 5") — plus
      // précis que le message générique, donc prioritaire s'il est présent.
      if (error.status === 422 && Array.isArray(error.errors) && error.errors.length > 0) {
        error.errors.forEach((message) => toast.error(String(message)))
      } else {
        toast.error(error.message || t('invoices.statusUpdateError'))
      }
    } finally {
      setIsUpdating(false)
      setStatusDialogOpen(false)
      setPendingStatus(null)
    }
  }

  const openStatusDialog = (status: InvoiceStatus) => {
    setPendingStatus(status)
    setStatusDialogOpen(true)
  }

  // Refetch manuel (sans recharger toute la page)
  const handleRefresh = () => {
    fetchInvoice()
  }

  // Ouvre la modale d'aperçu et charge le PDF (généré côté backend) en Blob
  const handlePreview = async () => {
    if (!invoice) return

    setIsPreviewOpen(true)
    setIsPreviewLoading(true)
    setPreviewError(null)

    try {
      const blob = await getInvoicePdfBlob(invoice.id, 'preview')
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Erreur lors de la génération de l\'aperçu')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Ferme la modale d'aperçu et révoque l'URL locale (évite les fuites mémoire)
  const handlePreviewOpenChange = (open: boolean) => {
    setIsPreviewOpen(open)

    if (!open) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setPreviewError(null)
    }
  }

  // Télécharge le PDF (généré côté backend) via un lien <a> temporaire
  const handleDownload = async () => {
    if (!invoice) return

    setIsDownloading(true)
    try {
      const blob = await getInvoicePdfBlob(invoice.id, 'download')
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `facture-${invoice.invoice_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('PDF téléchargé avec succès')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du téléchargement du PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  // Imprime le même PDF (généré côté backend, avec le thème choisi) que
  // l'aperçu/le téléchargement — pas window.print() sur la page HTML, qui
  // affichait une mise en page générique sans rapport avec le thème.
  const handlePrint = async () => {
    if (!invoice) return

    setIsPrinting(true)
    try {
      const blob = await getInvoicePdfBlob(invoice.id, 'preview')
      const url = URL.createObjectURL(blob)

      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;'
      iframe.src = url

      iframe.onload = () => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      }

      document.body.appendChild(iframe)

      // Impossible de détecter fermeture/annulation du dialog d'impression
      // de façon fiable dans tous les navigateurs : nettoyage différé plutôt
      // que de retirer l'iframe immédiatement (ce qui annulerait l'impression).
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 60_000)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la génération de l'impression")
    } finally {
      setIsPrinting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('invoices.loadingInvoice')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices" className="inline-flex items-center text-primary hover:underline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.goBack')}
          </Link>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    )
  }

  // No invoice state
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t('invoices.notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.goBack')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{invoice.invoice_number}</h1>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-muted-foreground">
              {t('invoices.issuedOn')} {dayjs(invoice.issued_at).format('DD MMMM YYYY')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Actions selon le statut */}
          {(invoice.status === 'unpaid' || invoice.status === 'overdue') && (
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => openStatusDialog('paid')}
              disabled={isUpdating}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {t('invoices.markAsPaid')}
            </Button>
          )}

          {/* Primary action buttons */}
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            {t('invoices.print')}
          </Button>

          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isPreviewLoading}
            title={t('invoices.previewInvoice')}
          >
            {isPreviewLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {t('invoices.preview')}
          </Button>

          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={isDownloading}
            title={t('invoices.downloadPdf')}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t('invoices.downloadPdf')}
          </Button>

          {/* Bouton de suppression (masqué pour les factures payées) */}
          <DeleteInvoiceButton
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            status={invoice.status}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company & Client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  {t('invoices.from')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  {invoice.company?.logo_url && !logoLoadFailed ? (
                    <img
                      src={invoice.company.logo_url}
                      alt={invoice.company.name || ''}
                      className="h-full w-full object-contain"
                      onError={() => setLogoLoadFailed(true)}
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{invoice.company?.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{invoice.company?.email}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  {t('invoices.pdf.billed_to')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-start gap-3">
                <div className="h-12 w-12 shrink-0 rounded-lg border bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{invoice.client?.name}</p>
                  {invoice.client?.email && (
                    <p className="text-sm text-muted-foreground truncate">{invoice.client.email}</p>
                  )}
                  {invoice.client?.phone && (
                    <p className="text-sm text-muted-foreground truncate">{invoice.client.phone}</p>
                  )}
                  {invoice.billing_address && (
                    <p className="text-sm text-muted-foreground mt-1">{invoice.billing_address}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('invoices.items')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoices.article')}</TableHead>
                      <TableHead className="text-right">{t('invoices.unitPrice')}</TableHead>
                      <TableHead className="text-right">{t('invoices.quantity')}</TableHead>
                      <TableHead className="text-right">{t('invoices.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.article?.image && (
                              <img
                                src={item.article.image}
                                alt={item.name_snapshot}
                                className="w-10 h-10 rounded object-cover"
                              />
                            )}
                            <span className="font-medium">{item.name_snapshot}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(item.unit_price)} {currency}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatAmount(item.total_line)} {currency}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          {(invoice.billing_address || invoice.shipping_address) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.billing_address && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('invoices.billingAddress')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line">{invoice.billing_address}</p>
                  </CardContent>
                </Card>
              )}

              {invoice.shipping_address && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('invoices.shippingAddress')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line">{invoice.shipping_address}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoice.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('invoices.notes')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line">{invoice.notes}</p>
                  </CardContent>
                </Card>
              )}
              {invoice.terms && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('invoices.terms')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line">{invoice.terms}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Totals */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('invoices.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
                <span>{formatAmount(invoice.subtotal)} {currency}</span>
              </div>

              {parseFloat(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    {t('invoices.discount')} ({invoice.discount_percent}%)
                  </span>
                  <span>- {formatAmount(invoice.discount_amount)} {currency}</span>
                </div>
              )}

              {parseFloat(invoice.tax_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('invoices.tax')} ({invoice.tax_percent}%)
                  </span>
                  <span>+ {formatAmount(invoice.tax_amount)} {currency}</span>
                </div>
              )}

              {parseFloat(invoice.shipping_fee) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoices.shippingFee')}</span>
                  <span>+ {formatAmount(invoice.shipping_fee)} {currency}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t('invoices.total')}</span>
                <span className="text-2xl font-bold text-green-600">
                  {invoice.formatted_total || `${formatAmount(invoice.total)} ${currency}`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('invoices.pdf.issued_date')}</p>
                  <p className="font-medium">{dayjs(invoice.issued_at).format('DD MMM YYYY')}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  invoice.is_overdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'
                }`}>
                  <Clock className={`h-5 w-5 ${invoice.is_overdue ? 'text-red-600' : ''}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('invoices.pdf.due_date')}</p>
                  <p className={`font-medium ${invoice.is_overdue ? 'text-red-600' : ''}`}>
                    {dayjs(invoice.due_date).format('DD MMM YYYY')}
                    {invoice.is_overdue && ` (${t('invoices.pdf.status_overdue')})`}
                  </p>
                  {invoice.days_until_due !== null && !invoice.is_overdue && invoice.days_until_due > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('invoices.daysRemaining', { count: invoice.days_until_due })}
                    </p>
                  )}
                </div>
              </div>

              {invoice.paid_at && (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('invoices.paidDate')}</p>
                    <p className="font-medium text-green-600">
                      {dayjs(invoice.paid_at).format('DD MMM YYYY')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation "Marquer comme payée" — seul statut encore déclenché via ce dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('invoices.confirmPaid')}</AlertDialogTitle>
            <AlertDialogDescription>{t('invoices.confirmPaidDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStatus && handleStatusChange(pendingStatus)}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aperçu PDF */}
      <Dialog open={isPreviewOpen} onOpenChange={handlePreviewOpenChange}>
        <DialogContent className="sm:max-w-4xl w-[calc(100%-2rem)] h-[85vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>{t('invoices.previewOf', { number: invoice.invoice_number })}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 rounded-md border bg-muted/30">
            {isPreviewLoading && (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{t('invoices.generatingPreview')}</p>
              </div>
            )}

            {!isPreviewLoading && previewError && (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  {t('common.retry')}
                </Button>
              </div>
            )}

            {!isPreviewLoading && !previewError && previewUrl && (
              <iframe
                src={previewUrl}
                title={t('invoices.previewOf', { number: invoice.invoice_number })}
                className="h-full w-full rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
