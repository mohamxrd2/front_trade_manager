'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import {
  ArrowLeft,
  Download,
  Printer,
  FileText,
  Building2,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  MoreVertical,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { InvoiceStatusBadge } from '@/components/invoices'
import { DeleteInvoiceButton } from '@/components/invoices/delete-invoice-button'
import api from '@/lib/api'
import type { Invoice, InvoiceStatus } from '@/lib/services/invoices'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

dayjs.locale('fr')

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const { currency } = useCurrency()

  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<InvoiceStatus | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Format currency from string
  const formatAmount = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
  }

  // ✅ SOLUTION: useEffect simple avec UNIQUEMENT [invoiceId] comme dépendance
  useEffect(() => {
    let isMounted = true // Flag pour éviter les updates sur composant unmount

    const fetchInvoice = async () => {
      if (!invoiceId) {
        setIsLoading(false)
        setError('ID de facture manquant')
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        console.debug('[InvoiceDetail] Fetching invoice:', invoiceId)

        const response = await api.get(`/api/invoices/${invoiceId}`)

        // Ne pas setter si le composant est unmount
        if (!isMounted) return

        if (response.data?.success && response.data?.data) {
          console.debug('[InvoiceDetail] Invoice loaded:', response.data.data.invoice_number)
          setInvoice(response.data.data)
        } else if (response.data?.id) {
          // Format alternatif
          setInvoice(response.data)
        } else {
          setError('Facture non trouvée')
        }
      } catch (err: unknown) {
        if (!isMounted) return
        console.error('[InvoiceDetail] Error:', err)
        const error = err as { response?: { data?: { message?: string } }; message?: string }
        setError(error.response?.data?.message || error.message || 'Erreur lors du chargement')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchInvoice()

    // Cleanup function
    return () => {
      isMounted = false
    }
  }, [invoiceId]) // ⚠️ UNIQUEMENT invoiceId - pas de fonction callback !

  // Changement de statut
  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return

    setIsUpdating(true)
    try {
      const response = await api.patch(`/api/invoices/${invoice.id}/status`, { status: newStatus })

      if (response.data?.success && response.data?.data) {
        setInvoice(response.data.data)
        toast.success(t('invoices.statusUpdated'))
      } else if (response.data?.id) {
        setInvoice(response.data)
        toast.success(t('invoices.statusUpdated'))
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } }; message?: string }
      toast.error(error.response?.data?.message || t('invoices.statusUpdateError'))
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

  // Refetch manuel
  const handleRefresh = () => {
    window.location.reload()
  }

  // Générer le HTML de la facture avec couleurs HEX pures (pas d'héritage CSS)
  const generateInvoiceHTML = () => {
    if (!invoice) return ''
    
    const formatPrice = (value: string | number) => {
      const num = typeof value === 'string' ? parseFloat(value) : value
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
    }
    
    const formatDate = (date: string) => dayjs(date).format('DD/MM/YYYY')
    
    const statusLabels: Record<string, { bg: string; color: string; label: string }> = {
      paid: { bg: '#dcfce7', color: '#166534', label: 'PAYÉE' },
      cancelled: { bg: '#fee2e2', color: '#991b1b', label: 'ANNULÉE' },
      overdue: { bg: '#fee2e2', color: '#991b1b', label: 'EN RETARD' },
      unpaid: { bg: '#fef3c7', color: '#92400e', label: 'NON PAYÉE' },
      draft: { bg: '#f3f4f6', color: '#374151', label: 'BROUILLON' },
    }
    
    const status = statusLabels[invoice.status] || statusLabels.unpaid
    
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5; color: #1f2937; background: #ffffff; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
          <div>
            ${invoice.company?.logo_url ? `<img src="${invoice.company.logo_url}" alt="" style="height: 60px; margin-bottom: 10px; object-fit: contain;" crossorigin="anonymous" />` : ''}
            <h2 style="margin: 0 0 5px 0; font-size: 18px; font-weight: bold; color: #1f2937;">${invoice.company?.name || ''}</h2>
            <p style="margin: 0; color: #6b7280;">${invoice.company?.email || ''}</p>
          </div>
          <div style="text-align: right;">
            <h1 style="margin: 0 0 10px 0; font-size: 28px; color: #16a34a;">FACTURE</h1>
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1f2937;">${invoice.invoice_number}</p>
            <p style="margin: 5px 0 0 0; color: #6b7280;">Date: ${formatDate(invoice.issued_at)}</p>
            <p style="margin: 5px 0 0 0; color: #6b7280;">Échéance: ${formatDate(invoice.due_date)}</p>
          </div>
        </div>
        
        <div style="margin-bottom: 30px;">
          <span style="display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; background-color: ${status.bg}; color: ${status.color};">${status.label}</span>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Facturé à:</h3>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1f2937;">${invoice.client?.name || ''}</p>
          ${invoice.client?.email ? `<p style="margin: 5px 0 0 0; color: #6b7280;">${invoice.client.email}</p>` : ''}
          ${invoice.client?.phone ? `<p style="margin: 5px 0 0 0; color: #6b7280;">${invoice.client.phone}</p>` : ''}
          ${invoice.billing_address ? `<p style="margin: 10px 0 0 0; color: #6b7280; white-space: pre-line;">${invoice.billing_address}</p>` : ''}
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: bold; color: #1f2937;">Article</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; font-weight: bold; color: #1f2937;">Prix unitaire</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; font-weight: bold; color: #1f2937;">Qté</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; font-weight: bold; color: #1f2937;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items?.map((item, i) => `
              <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${item.name_snapshot}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${formatPrice(item.unit_price)} ${currency}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${item.quantity}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #1f2937;">${formatPrice(item.total_line)} ${currency}</td>
              </tr>
            `).join('') || ''}
          </tbody>
        </table>
        
        <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
          <div style="width: 300px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #6b7280;">Sous-total</span>
              <span style="color: #1f2937;">${formatPrice(invoice.subtotal)} ${currency}</span>
            </div>
            ${parseFloat(invoice.discount_amount) > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #16a34a;">
                <span>Remise (${invoice.discount_percent}%)</span>
                <span>-${formatPrice(invoice.discount_amount)} ${currency}</span>
              </div>
            ` : ''}
            ${parseFloat(invoice.tax_amount) > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">TVA (${invoice.tax_percent}%)</span>
                <span style="color: #1f2937;">+${formatPrice(invoice.tax_amount)} ${currency}</span>
              </div>
            ` : ''}
            ${parseFloat(invoice.shipping_fee) > 0 ? `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">Frais de livraison</span>
                <span style="color: #1f2937;">+${formatPrice(invoice.shipping_fee)} ${currency}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 16px 0; font-size: 18px; font-weight: bold;">
              <span style="color: #1f2937;">Total</span>
              <span style="color: #16a34a;">${invoice.formatted_total || `${formatPrice(invoice.total)} ${currency}`}</span>
            </div>
          </div>
        </div>
        
        ${invoice.notes ? `
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Notes:</h3>
            <p style="margin: 0; white-space: pre-line; color: #1f2937;">${invoice.notes}</p>
          </div>
        ` : ''}
        
        ${invoice.terms ? `
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Conditions:</h3>
            <p style="margin: 0; white-space: pre-line; color: #1f2937;">${invoice.terms}</p>
          </div>
        ` : ''}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 11px;">
          <p style="margin: 0;">Merci pour votre confiance !</p>
          <p style="margin: 5px 0 0 0;">${invoice.company?.name || ''} - ${invoice.company?.email || ''}</p>
        </div>
      </div>
    `
  }

  // Télécharger le PDF avec html2pdf - Version HTML string (évite les couleurs oklch/lab)
  const handleDownloadPdf = async () => {
    if (!invoice) return

    setIsDownloading(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default

      // ✅ Créer un élément avec HTML string pur (pas d'héritage CSS)
      const element = document.createElement('div')
      element.innerHTML = generateInvoiceHTML()
      element.style.cssText = 'position: absolute; left: -9999px; top: -9999px;'
      document.body.appendChild(element)

      const options = {
        margin: [10, 10, 10, 10],
        filename: `${invoice.invoice_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'],
          avoid: ['tr', 'td', 'div', 'table']
        },
      }

      await html2pdf().set(options).from(element.firstChild).save()
      
      document.body.removeChild(element)
      toast.success('PDF téléchargé avec succès')
    } catch (err: unknown) {
      console.error('[PDF Download] Error:', err)
      toast.error('Erreur lors de la génération du PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Chargement de la facture...</p>
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
            Réessayer
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
              Émise le {dayjs(invoice.issued_at).format('DD MMMM YYYY')}
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

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <Button
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive hover:text-white"
              onClick={() => openStatusDialog('cancelled')}
              disabled={isUpdating}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t('invoices.cancel')}
            </Button>
          )}

          {/* Primary action buttons */}
          <Button
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            {t('invoices.print')}
          </Button>

          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            title="Télécharger la facture en PDF"
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t('invoices.downloadPdf')}
          </Button>

          {/* Bouton de suppression (pas pour les factures payées) */}
          <DeleteInvoiceButton 
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            status={invoice.status}
          />

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={isUpdating}>
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreVertical className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {invoice.status === 'paid' && (
                <DropdownMenuItem onClick={() => handleStatusChange('unpaid')}>
                  <XCircle className="mr-2 h-4 w-4 text-orange-600" />
                  Marquer non payée
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
              <CardContent>
                {invoice.company?.logo_url && (
                  <img
                    src={invoice.company.logo_url}
                    alt={invoice.company.name}
                    className="h-12 mb-2 object-contain"
                  />
                )}
                <p className="font-medium">{invoice.company?.name}</p>
                <p className="text-sm text-muted-foreground">{invoice.company?.email}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  {t('invoices.to')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{invoice.client?.name}</p>
                {invoice.client?.email && (
                  <p className="text-sm text-muted-foreground">{invoice.client.email}</p>
                )}
                {invoice.client?.phone && (
                  <p className="text-sm text-muted-foreground">{invoice.client.phone}</p>
                )}
                {invoice.billing_address && (
                  <p className="text-sm text-muted-foreground mt-1">{invoice.billing_address}</p>
                )}
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
                  <p className="text-sm text-muted-foreground">Date d&apos;émission</p>
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
                  <p className="text-sm text-muted-foreground">Date d&apos;échéance</p>
                  <p className={`font-medium ${invoice.is_overdue ? 'text-red-600' : ''}`}>
                    {dayjs(invoice.due_date).format('DD MMM YYYY')}
                    {invoice.is_overdue && ' (En retard)'}
                  </p>
                  {invoice.days_until_due !== null && !invoice.is_overdue && invoice.days_until_due > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {invoice.days_until_due} jours restants
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

      {/* Status Change Dialog */}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === 'paid'
                ? t('invoices.confirmPaid')
                : t('invoices.confirmCancel')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === 'paid'
                ? t('invoices.confirmPaidDescription')
                : t('invoices.confirmCancelDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingStatus && handleStatusChange(pendingStatus)}
              disabled={isUpdating}
              className={
                pendingStatus === 'paid'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
