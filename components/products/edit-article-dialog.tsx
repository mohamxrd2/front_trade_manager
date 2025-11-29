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
import { updateArticle, type Article, type UpdateArticlePayload } from '@/lib/services/articles'
import { useCurrency } from '@/lib/utils/currency'

const articleSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(255, "Le nom ne peut pas dépasser 255 caractères"),
  sale_price: z.string().min(1, "Le prix est requis"),
  quantity: z.string().min(1, "La quantité est requise"),
})

interface EditArticleDialogProps {
  article: Article | null
  open: boolean
  onClose: () => void
  onSuccess: (updatedArticle: Article) => void
}

export function EditArticleDialog({
  article,
  open,
  onClose,
  onSuccess,
}: EditArticleDialogProps) {
  const { currency } = useCurrency()
  const [loading, setLoading] = useState(false)

  const form = useForm<{
    name: string
    sale_price: string
    quantity: string
  }>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      name: '',
      sale_price: '',
      quantity: '',
    },
  })

  // Réinitialiser le formulaire quand l'article change ou la modale s'ouvre
  useEffect(() => {
    if (article && open) {
      form.reset({
        name: article.name,
        sale_price: String(article.sale_price),
        quantity: String(article.quantity),
      })
    }
  }, [article, open, form])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const onSubmit = async (data: { name: string; sale_price: string; quantity: string }) => {
    if (!article) return

    setLoading(true)
    try {
      const salePriceNum = parseFloat(data.sale_price)
      const quantityNum = parseInt(data.quantity, 10)

      if (isNaN(salePriceNum) || salePriceNum < 0) {
        toast.error('Le prix doit être supérieur ou égal à 0')
        return
      }

      if (isNaN(quantityNum) || quantityNum < 0) {
        toast.error('La quantité doit être supérieure ou égale à 0')
        return
      }

      const payload: UpdateArticlePayload = {
        name: data.name,
        sale_price: salePriceNum,
        quantity: quantityNum,
      }

      const updatedArticle = await updateArticle(article.id, payload)

      toast.success('Article modifié avec succès')

      // Mettre à jour l'article dans le parent
      onSuccess(updatedArticle)
      
      // Fermer la modale après modification réussie
      onClose()
    } catch (error: unknown) {
      const errorObj = error as { message?: string; validationErrors?: Record<string, string[]>; status?: number }
      
      if (errorObj.status === 422 && errorObj.validationErrors) {
        Object.keys(errorObj.validationErrors).forEach(key => {
          const fieldName = key as 'name' | 'sale_price' | 'quantity'
          if (fieldName === 'name' || fieldName === 'sale_price' || fieldName === 'quantity') {
            form.setError(fieldName, { message: errorObj.validationErrors![key][0] })
          }
        })
        toast.error('Erreur de validation. Veuillez corriger les erreurs dans le formulaire')
      } else if (errorObj.status === 404) {
        toast.error('Article non trouvé')
      } else if (errorObj.status === 403) {
        toast.error('Vous n\'êtes pas autorisé à modifier cet article')
      } else {
        toast.error(errorObj.message || 'Erreur lors de la modification de l\'article')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!article) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;article</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nom */}
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l&apos;article *</Label>
              <Input
                id="name"
                placeholder="Ex: Ordinateur Portable Dell"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Prix unitaire */}
            <div className="space-y-2">
              <Label htmlFor="sale_price">Prix unitaire *</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 5000 fcfa"
                {...form.register('sale_price')}
              />
              <p className="text-sm text-muted-foreground">
                Prix actuel : {formatCurrency(article.sale_price)} {currency}
              </p>
              {form.formState.errors.sale_price && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.sale_price.message}
                </p>
              )}
            </div>

            {/* Quantité */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                placeholder="Ex: 50 pieces"
                {...form.register('quantity')}
              />
              <p className="text-sm text-muted-foreground">
                Quantité actuelle : {article.quantity}
                {article.sold_quantity !== undefined && (
                  <span className="ml-2">
                    (Vendu: {article.sold_quantity}, Restant: {article.remaining_quantity})
                  </span>
                )}
              </p>
              {form.formState.errors.quantity && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Fermer
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Modification...' : 'Modifier l\'article'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

