'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { InvoiceForm } from '@/components/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

export default function NewInvoicePage() {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('invoices.newInvoice')}</h1>
          <p className="text-muted-foreground">{t('invoices.newInvoiceDescription')}</p>
        </div>
      </div>

      {/* Multi-step Form */}
      <InvoiceForm />
    </div>
  )
}

