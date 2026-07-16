'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Package, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addStock, type Article } from '@/lib/services/articles'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const addStockSchema = z.object({
  quantity: z
    .number({
      required_error: 'La quantité est requise',
      invalid_type_error: 'La quantité doit être un nombre',
    })
    .int('La quantité doit être un nombre entier')
    .min(1, 'La quantité doit être au moins 1'),
})

type AddStockFormData = z.infer<typeof addStockSchema>

// ============================================================================
// PROPS
// ============================================================================

interface AddStockDialogProps {
  article: Article
  open: boolean
  onClose: () => void
  onSuccess: (updatedArticle: Article) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddStockDialog({ article, open, onClose, onSuccess }: AddStockDialogProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddStockFormData>({
    resolver: zodResolver(addStockSchema),
    defaultValues: {
      quantity: 1,
    },
  })

  const onSubmit = async (data: AddStockFormData) => {
    setIsSubmitting(true)

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('📦 AddStockDialog: Adding stock...', { articleId: article.id, quantity: data.quantity })
      }

      const updatedArticle = await addStock(article.id, data.quantity)

      if (process.env.NODE_ENV !== 'production') {
        console.debug('✅ AddStockDialog: Stock added successfully, calling onSuccess...')
      }

      // Toast succès
      toast.success(t('products.stockAddedSuccess'))

      // Reset le formulaire
      reset({ quantity: 1 })

      // Callback de succès - déclenche le refresh de l'historique
      onSuccess(updatedArticle)

      // Fermer le dialog
      onClose()
    } catch (error: unknown) {
      const err = error as Error & { status?: number; errors?: Record<string, string[]> }

      // Erreur de validation (422)
      if (err.status === 422 && err.errors) {
        const firstError = Object.values(err.errors)[0]
        toast.error(firstError?.[0] || t('products.stockAddError'))
      } else {
        // Autres erreurs
        toast.error(err.message || t('products.stockAddError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      reset({ quantity: 1 })
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-green-600" />
            {t('products.addStock')}
          </DialogTitle>
          <DialogDescription>
            {t('products.addStockDescription', { name: article.name })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Informations actuelles */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('products.currentStock')}</span>
              <span className="font-semibold">{article.remaining_quantity} {t('common.units')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{t('products.initialQuantity')}</span>
              <span className="font-medium">{article.quantity} {t('common.units')}</span>
            </div>
          </div>

          {/* Champ quantité */}
          <div className="space-y-2">
            <Label htmlFor="quantity" className="flex items-center gap-1">
              {t('products.quantityToAdd')}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              placeholder="1"
              className={errors.quantity ? 'border-destructive focus-visible:ring-destructive' : ''}
              {...register('quantity', { valueAsNumber: true })}
              disabled={isSubmitting}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('common.confirm')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

