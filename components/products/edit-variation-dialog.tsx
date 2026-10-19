'use client'

import { useState, useEffect } from 'react'
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

const variationSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(255, "Le nom ne peut pas dépasser 255 caractères"),
  quantity: z.string().min(1, "La quantité est requise"),
  price: z.string().min(1, "Le prix est requis"),
})

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
  const [loading, setLoading] = useState(false)

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
        toast.error('La quantité doit être positive ou nulle')
        return
      }

      const priceNum = parseFloat(data.price)
      if (isNaN(priceNum) || priceNum <= 0) {
        toast.error('Le prix doit être supérieur à 0')
        return
      }

      const payload: UpdateVariationPayload = {
        name: data.name,
        quantity: quantityNum,
        price: priceNum,
      }

      const updatedVariation = await updateVariation(variation.id, payload)

      toast.success('Variation modifiée avec succès')

      onSuccess(updatedVariation)
      onClose()
    } catch (error: unknown) {
      const errorObj = error as { message?: string; validationErrors?: Record<string, string[]> }

      if (errorObj.validationErrors) {
        const firstError = Object.values(errorObj.validationErrors)[0]
        toast.error(firstError?.[0] || 'Erreur de validation')
      } else {
        toast.error(errorObj.message || 'Erreur lors de la modification de la variation')
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
          <DialogTitle>Modifier la variation</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variation-name">Nom de la variation *</Label>
            <Input
              id="variation-name"
              placeholder="Ex: Taille S"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variation-quantity">Quantité *</Label>
            <Input
              id="variation-quantity"
              type="number"
              min="0"
              placeholder="Ex: 20"
              {...form.register('quantity')}
            />
            {form.formState.errors.quantity && (
              <p className="text-sm text-red-500">{form.formState.errors.quantity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variation-price">Prix de vente *</Label>
            <Input
              id="variation-price"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 15000"
              {...form.register('price')}
            />
            {form.formState.errors.price && (
              <p className="text-sm text-red-500">{form.formState.errors.price.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Modification...' : 'Modifier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
