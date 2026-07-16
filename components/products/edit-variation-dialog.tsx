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
  article,
  open,
  onClose,
  onSuccess,
}: EditVariationDialogProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<{
    name: string
    quantity: string
  }>({
    resolver: zodResolver(variationSchema),
    defaultValues: {
      name: '',
      quantity: '',
    },
  })

  useEffect(() => {
    if (variation && open) {
      form.reset({
        name: variation.name,
        quantity: String(variation.quantity),
      })
    }
  }, [variation, open, form])

  // Calculer la quantité disponible pour cette variation
  const totalOtherVariationsQuantity = article.variations
    ?.filter(v => v.id !== variation?.id)
    .reduce((sum, v) => sum + v.quantity, 0) || 0
  const availableQuantity = article.quantity - totalOtherVariationsQuantity

  const onSubmit = async (data: { name: string; quantity: string }) => {
    if (!variation) return

    setLoading(true)
    try {
      const quantityNum = parseInt(data.quantity, 10)
      if (isNaN(quantityNum) || quantityNum < 1) {
        toast.error('La quantité doit être supérieure à 0')
        return
      }

      if (quantityNum > availableQuantity) {
        toast.error(`La quantité dépasse la quantité disponible. Quantité disponible: ${availableQuantity}`)
        return
      }

      const payload: UpdateVariationPayload = {
        name: data.name,
        quantity: quantityNum,
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
              min="1"
              max={availableQuantity}
              placeholder="Ex: 20 pieces"
              {...form.register('quantity')}
            />
            <p className="text-sm text-muted-foreground">
              Quantité disponible : {availableQuantity}
            </p>
            {form.formState.errors.quantity && (
              <p className="text-sm text-red-500">{form.formState.errors.quantity.message}</p>
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

