'use client'

import { Calculator, Percent, DollarSign, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useInvoiceForm } from './invoice-form-context'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import type { DiscountType } from '@/lib/services/invoices'

export function StepTotals() {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const {
    formData,
    updateFormData,
    subtotal,
    discountAmount,
    taxAmount,
    total,
  } = useInvoiceForm()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" />
            {t('invoices.adjustments')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Remise */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              {t('invoices.discount')}
            </Label>
            <div className="flex gap-2">
              <Select
                value={formData.discountType}
                onValueChange={(value: DiscountType) =>
                  updateFormData({ discountType: value })
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t('invoices.percentage')}</SelectItem>
                  <SelectItem value="fixed">{t('invoices.fixedAmount')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Input
                  type="number"
                  min={0}
                  step={formData.discountType === 'percentage' ? 1 : 0.01}
                  max={formData.discountType === 'percentage' ? 100 : undefined}
                  value={formData.discountValue || ''}
                  onChange={(e) =>
                    updateFormData({
                      discountValue: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="pr-10"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {formData.discountType === 'percentage' ? '%' : currency}
                </span>
              </div>
            </div>
          </div>

          {/* Taxe */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {t('invoices.tax')}
            </Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={formData.taxRate || ''}
                onChange={(e) =>
                  updateFormData({
                    taxRate: parseFloat(e.target.value) || 0,
                  })
                }
                className="pr-10"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                %
              </span>
            </div>
          </div>

          {/* Frais de livraison */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              {t('invoices.shippingFee')}
            </Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formData.shippingFee || ''}
                onChange={(e) =>
                  updateFormData({
                    shippingFee: parseFloat(e.target.value) || 0,
                  })
                }
                className="pr-16"
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currency}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Récapitulatif */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">{t('invoices.summary')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sous-total */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
            <span className="font-medium">{formatCurrency(subtotal)} {currency}</span>
          </div>

          {/* Remise */}
          {discountAmount > 0 && (
            <div className="flex justify-between text-red-600 dark:text-red-400">
              <span>
                {t('invoices.discount')} 
                {formData.discountType === 'percentage' && ` (${formData.discountValue}%)`}
              </span>
              <span>- {formatCurrency(discountAmount)} {currency}</span>
            </div>
          )}

          {/* Taxe */}
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t('invoices.tax')} ({formData.taxRate}%)
              </span>
              <span className="font-medium">+ {formatCurrency(taxAmount)} {currency}</span>
            </div>
          )}

          {/* Frais de livraison */}
          {formData.shippingFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('invoices.shippingFee')}</span>
              <span className="font-medium">+ {formatCurrency(formData.shippingFee)} {currency}</span>
            </div>
          )}

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">{t('invoices.total')}</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(total)} {currency}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

