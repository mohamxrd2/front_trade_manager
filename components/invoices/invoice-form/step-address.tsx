'use client'

import { MapPin, Calendar, FileText, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useInvoiceForm } from './invoice-form-context'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

export function StepAddress() {
  const { t } = useTranslation()
  const { formData, updateFormData } = useInvoiceForm()

  const copyBillingToShipping = () => {
    updateFormData({ shippingAddress: formData.billingAddress })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Adresse de facturation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              {t('invoices.billingAddress')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.billingAddress}
              onChange={(e) => updateFormData({ billingAddress: e.target.value })}
              placeholder={t('invoices.billingAddressPlaceholder')}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Adresse de livraison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5" />
                {t('invoices.shippingAddress')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyBillingToShipping}
                disabled={!formData.billingAddress}
              >
                <Copy className="mr-2 h-4 w-4" />
                {t('invoices.copyBilling')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.shippingAddress}
              onChange={(e) => updateFormData({ shippingAddress: e.target.value })}
              placeholder={t('invoices.shippingAddressPlaceholder')}
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Date d'échéance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            {t('invoices.dueDate')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label className="sr-only">{t('invoices.dueDate')}</Label>
            <Input
              type="date"
              value={formData.dueDate || ''}
              onChange={(e) => updateFormData({ dueDate: e.target.value || null })}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {t('invoices.dueDateDescription')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            {t('invoices.notes')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) => updateFormData({ notes: e.target.value })}
            placeholder={t('invoices.notesPlaceholder')}
            rows={3}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {t('invoices.notesDescription')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

