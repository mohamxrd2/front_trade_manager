'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateVariation, type Variation, type UpdateVariationPayload } from '@/lib/services/variations'
import type { Article } from '@/lib/services/articles'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

function buildVariationSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z.object({
    name: z.string().min(1, t('products.editVariationDialog.validationNameRequired')).max(255, t('products.editVariationDialog.validationNameMax')),
    quantity: z.string().min(1, t('products.editVariationDialog.validationQuantityRequired')),
    price: z.string().min(1, t('products.editVariationDialog.validationPriceRequired')),
  })
}

interface EditVariationDialogProps {
  variation: Variation | null
  article: Article
  open: boolean
  onClose: () => void
  onSuccess: (updatedVariation: Variation) => void
}

export function EditVariationDialog({
  variation,
  open,
  onClose,
  onSuccess,
}: EditVariationDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const variationSchema = useMemo(() => buildVariationSchema(t), [t])
  const form = useForm<{
    name: string
    quantity: string
    price: string
  }>({
    resolver: zodResolver(variationSchema),
    defaultValues: {
      name: '',
      quantity: '',
      price: '',
    },
  })

  useEffect(() => {
    if (variation && open) {
      form.reset({
        name: variation.name,
        quantity: String(variation.quantity),
        price: String(variation.price),
      })
    }
  }, [variation, open, form])

  const onSubmit = async (data: { name: string; quantity: string; price: string }) => {
    if (!variation) return

    setLoading(true)
    try {
      const quantityNum = parseInt(data.quantity, 10)
      if (isNaN(quantityNum) || quantityNum < 0) {
        toast.error(t('products.editVariationDialog.errorQuantityPositive'))
        return
      }

      const priceNum = parseFloat(data.price)
      if (isNaN(priceNum) || priceNum <= 0) {
        toast.error(t('products.editVariationDialog.errorPricePositive'))
        return
      }

      const payload: UpdateVariationPayload = {
        name: data.name,
        quantity: quantityNum,
        price: priceNum,
      }

      const updatedVariation = await updateVariation(variation.id, payload)

      toast.success(t('products.editVariationDialog.successModified'))

      onSuccess(updatedVariation)
      onClose()
    } catch (error: unknown) {
      const errorObj = error as { message?: string; validationErrors?: Record<string, string[]> }

      if (errorObj.validationErrors) {
        const firstError = Object.values(errorObj.validationErrors)[0]
        toast.error(firstError?.[0] || t('products.editVariationDialog.errorValidation'))
      } else {
        toast.error(errorObj.message || t('products.editVariationDialog.errorModifyFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  if (!variation) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('products.editVariationDialog.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variation-name">{t('products.editVariationDialog.nameLabel')}</Label>
            <Input
              id="variation-name"
              placeholder={t('products.editVariationDialog.namePlaceholder')}
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variation-quantity">{t('products.editVariationDialog.quantityLabel')}</Label>
            <Input
              id="variation-quantity"
              type="number"
              min="0"
              placeholder={t('products.editVariationDialog.quantityPlaceholder')}
              {...form.register('quantity')}
            />
            {form.formState.errors.quantity && (
              <p className="text-sm text-red-500">{form.formState.errors.quantity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variation-price">{t('products.editVariationDialog.priceLabel')}</Label>
            <Input
              id="variation-price"
              type="number"
              min="0"
              step="0.01"
              placeholder={t('products.editVariationDialog.pricePlaceholder')}
              {...form.register('price')}
            />
            {form.formState.errors.price && (
              <p className="text-sm text-red-500">{form.formState.errors.price.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {t('products.editVariationDialog.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('products.editVariationDialog.modifying') : t('products.editVariationDialog.modify')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
