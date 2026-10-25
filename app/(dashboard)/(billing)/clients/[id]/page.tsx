'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft } from 'lucide-react'

import { getClientById, getInvoices, type Client, type Invoice } from '@/lib/services/invoices'
import { Button } from '@/components/waelly'
import { ClientDetailCard } from '@/components/clients/client-detail-card'
import { ClientFormDialog } from '@/components/clients/client-form-dialog'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/**
 * Fiche client en pleine page — même contenu que le panneau "Aperçu" de
 * /clients (design/maquettes/ordinateur/Web-Clients.dc.html), ouverte par
 * le tap sur une carte client en mobile.
 */
export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslation()
  const clientId = params.id as string

  const [client, setClient] = React.useState<Client | null>(null)
  const [invoices, setInvoices] = React.useState<Invoice[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getClientById(clientId)
      let currentPage = 1
      let all: Invoice[] = []
      for (;;) {
        const { invoices: pageData, pages } = await getInvoices({ client_id: clientId, page: currentPage, per_page: 100 })
        all = all.concat(pageData)
        if (currentPage >= pages) break
        currentPage += 1
      }
      setClient(data)
      setInvoices(all)
    } catch (err: unknown) {
      setError((err as Error).message || t('clients.page.loadErrorRetry'))
    } finally {
      setIsLoading(false)
    }
  }, [clientId, t])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalBilled = invoices
    .filter((i) => i.status !== 'draft' && i.status !== 'cancelled')
    .reduce((s, i) => s + Number(i.total), 0)
  const amountDue = invoices
    .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
    .reduce((s, i) => s + Number(i.total), 0)

  const handleDeleted = () => {
    router.push('/clients')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 pb-28">
        <div className="h-8 w-40 animate-pulse rounded bg-surface-soft" />
        <div className="h-[460px] animate-pulse rounded-tile bg-surface-soft" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="size-12 text-subtle" />
        <p className="text-sm text-subtle">{error || t('clients.page.notFound')}</p>
        <Button variant="secondary" onClick={fetchData}>
          {t('wallet.list.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-32">
      <div className="flex items-center">
        <Link
          href="/clients"
          aria-label={t('clients.page.backToClientsAria')}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </div>

      <ClientDetailCard client={client} invoices={invoices} totalBilled={totalBilled} amountDue={amountDue} />

      <div className="glass fixed inset-x-3.5 bottom-[22px] z-30 flex gap-2.5 rounded-[32px] p-2.5">
        <Button variant="secondary" className="flex-1" onClick={() => setFormOpen(true)}>
          {t('products.detail.modify')}
        </Button>
        <Button variant="black" className="flex-1" asChild>
          <Link href={`/invoices/new?client=${client.id}`}>{t('clients.page.invoiceAction')}</Link>
        </Button>
      </div>

      <ClientFormDialog
        open={formOpen}
        client={client}
        invoicesCount={invoices.length}
        onClose={() => setFormOpen(false)}
        onSuccess={(updated) => {
          setFormOpen(false)
          setClient(updated)
        }}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
