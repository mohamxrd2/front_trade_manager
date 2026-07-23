'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { type Transaction } from './transaction-card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useAnalyticsRefresh } from '@/lib/hooks/use-analytics-refresh'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { isSilentError } from '@/lib/utils/error-handler'
import { useCurrency } from '@/lib/utils/currency'

// Schéma de validation pour une vente
// Note: name n'est pas modifiable pour les ventes
const saleSchema = z.object({
  quantity: z
    .string()
    .optional()
    .transform((val) => val === '' || val === undefined ? undefined : parseInt(val, 10))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 1), {
      message: "La quantité doit être au moins 1",
    }),
  sale_price: z
    .string()
    .optional()
    .transform((val) => val === '' || val === undefined ? undefined : parseFloat(val))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: "Le prix de vente doit être positif",
    }),
}).refine(
  (data) => data.quantity !== undefined || data.sale_price !== undefined,
  {
    message: "Vous devez modifier au moins la quantité ou le prix de vente",
    path: ["quantity"],
  }
)

// Schéma de validation pour une dépense
const expenseSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  amount: z
    .string()
    .optional()
    .transform((val) => val === '' || val === undefined ? undefined : parseFloat(val))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: "Le montant doit être positif",
    }),
})

type SaleFormData = z.infer<typeof saleSchema>
type ExpenseFormData = z.infer<typeof expenseSchema>

interface EditTransactionDialogProps {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: Partial<Transaction>) => Promise<void>
}

/**
 * Formatage de la devise
 */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Dialog pour modifier une transaction
 * - Vente : modifier name, quantity et/ou sale_price
 * - Dépense : modifier name et/ou amount
 */
export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSave,
}: EditTransactionDialogProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const { refreshAnalytics } = useAnalyticsRefresh()
  const isSale = transaction?.type === 'sale'

  // Formulaire pour une vente
  const saleForm = useForm<z.input<typeof saleSchema>, unknown, SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      quantity: '',
      sale_price: '',
    },
  })

  // Formulaire pour une dépense
  const expenseForm = useForm<z.input<typeof expenseSchema>, unknown, ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: '',
      amount: '',
    },
  })

  // Réinitialiser les formulaires quand la transaction change
  useEffect(() => {
    if (transaction) {
      if (transaction.type === 'sale') {
        // Pour les ventes, name n'est pas modifiable
        saleForm.reset({
          quantity: transaction.quantity?.toString() || '',
          sale_price: transaction.sale_price?.toString() || transaction.unit_price?.toString() || '',
        })
      } else {
        expenseForm.reset({
          name: transaction.name || '',
          amount: transaction.amount?.toString() || '',
        })
      }
    }
  }, [transaction, saleForm, expenseForm])

  // Observer les valeurs du formulaire pour calculer amount en temps réel (ventes)
  const watchedQuantity = saleForm.watch('quantity')
  const watchedSalePrice = saleForm.watch('sale_price')

  // Calculer amount en temps réel pour les ventes
  const calculatedAmount = useMemo(() => {
    if (!isSale || !transaction) return 0
    
    const quantity = watchedQuantity ? parseInt(watchedQuantity, 10) : transaction.quantity || 0
    const salePrice = watchedSalePrice ? parseFloat(watchedSalePrice) : (transaction.sale_price || transaction.unit_price || 0)
    
    return quantity * salePrice
  }, [isSale, transaction, watchedQuantity, watchedSalePrice])

  // Détecter si la quantité a changé
  const quantityChanged = useMemo(() => {
    if (!isSale || !transaction) return false
    const currentQuantity = watchedQuantity ? parseInt(watchedQuantity, 10) : transaction.quantity
    return currentQuantity !== transaction.quantity
  }, [isSale, transaction, watchedQuantity])

  // Gérer la soumission d'une vente
  const onSaleSubmit = async (data: SaleFormData) => {
    if (!transaction) return

    try {
      console.log('💾 Soumission formulaire vente:', data);
      
      // Préparer le payload avec seulement les champs modifiés
      // Note: name n'est pas modifiable pour les ventes, on garde le nom existant
      const payload: {
        name: string;
        quantity?: number;
        sale_price?: number;
      } = {
        name: transaction.name, // Garder le nom existant (non modifiable)
      };

      // Ajouter quantity seulement si modifié
      if (data.quantity !== undefined) {
        const newQuantity = parseInt(data.quantity.toString(), 10);
        if (newQuantity !== transaction.quantity) {
          payload.quantity = newQuantity;
        }
      }

      // Ajouter sale_price seulement si modifié
      if (data.sale_price !== undefined) {
        const newPrice = parseFloat(data.sale_price.toString());
        const originalPrice = transaction.sale_price || transaction.unit_price || 0;
        if (newPrice !== originalPrice) {
          payload.sale_price = newPrice;
        }
      }

      console.log('📤 Payload vente:', payload);

      await onSave(transaction.id, payload);
      
      // Rafraîchir les Analytics
      refreshAnalytics()
      
      saleForm.reset()
      onOpenChange(false)
    } catch (err: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(err)) {
        return
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur dans onSaleSubmit:', err)
      }

      const error = err as { validationErrors?: Record<string, string[] | string>; message?: string }

      // Gérer les erreurs de validation
      if (error.validationErrors) {
        const validationErrors = error.validationErrors;
        console.log('🔍 Erreurs de validation:', validationErrors);
        
        // Parcourir toutes les erreurs
        Object.keys(validationErrors).forEach((key) => {
          // Ignorer les erreurs générales pour l'affichage dans les champs
          if (key === '_general') {
            const message = Array.isArray(validationErrors[key]) 
              ? validationErrors[key][0] 
              : validationErrors[key];
            toast.error(message || 'Erreur de validation');
            return;
          }
          
          // Mapper les clés API vers les clés du formulaire
          const fieldMap: Record<string, keyof SaleFormData> = {
            quantity: 'quantity',
            sale_price: 'sale_price',
          }
          
          const field = fieldMap[key] || key as keyof SaleFormData;
          const errorMessage = Array.isArray(validationErrors[key]) 
            ? validationErrors[key][0] 
            : validationErrors[key];
          
          if (field && errorMessage) {
            saleForm.setError(field, {
              message: errorMessage,
            })
          }
        })
      } else if (error.message) {
        toast.error(error.message)
      } else {
        toast.error('Une erreur est survenue lors de la modification')
      }
    }
  }

  // Gérer la soumission d'une dépense
  const onExpenseSubmit = async (data: ExpenseFormData) => {
    if (!transaction) return

    try {
      console.log('💾 Soumission formulaire dépense:', data);
      
      // Préparer le payload avec seulement les champs modifiés
      const payload: {
        name: string;
        amount?: number;
      } = {
        name: data.name,
      };

      // Ajouter amount seulement si modifié
      if (data.amount !== undefined) {
        const newAmount = parseFloat(data.amount.toString());
        if (newAmount !== transaction.amount) {
          payload.amount = newAmount;
        }
      }

      console.log('📤 Payload dépense:', payload);

      await onSave(transaction.id, payload);
      
      // Rafraîchir les Analytics
      refreshAnalytics()
      
      expenseForm.reset()
      onOpenChange(false)
    } catch (err: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(err)) {
        return
      }

      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur dans onExpenseSubmit:', err)
      }

      const error = err as { validationErrors?: Record<string, string[] | string>; message?: string }

      // Gérer les erreurs de validation
      if (error.validationErrors) {
        const validationErrors = error.validationErrors;
        console.log('🔍 Erreurs de validation:', validationErrors);
        
        // Parcourir toutes les erreurs
        Object.keys(validationErrors).forEach((key) => {
          // Ignorer les erreurs générales pour l'affichage dans les champs
          if (key === '_general') {
            const message = Array.isArray(validationErrors[key]) 
              ? validationErrors[key][0] 
              : validationErrors[key];
            toast.error(message || 'Erreur de validation');
            return;
          }
          
          // Mapper les clés API vers les clés du formulaire
          const fieldMap: Record<string, keyof ExpenseFormData> = {
            name: 'name',
            amount: 'amount',
          }
          
          const field = fieldMap[key] || key as keyof ExpenseFormData;
          const errorMessage = Array.isArray(validationErrors[key]) 
            ? validationErrors[key][0] 
            : validationErrors[key];
          
          if (field && errorMessage) {
            expenseForm.setError(field, {
              message: errorMessage,
            })
          }
        })
      } else if (error.message) {
        toast.error(error.message)
      } else {
        toast.error('Une erreur est survenue lors de la modification')
      }
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Modifier {isSale ? 'une vente' : 'une dépense'}
          </DialogTitle>
          <DialogDescription>
            {isSale
              ? 'Modifiez la quantité et/ou le prix de vente. Le montant sera recalculé automatiquement.'
              : 'Modifiez le nom et/ou le montant de la dépense.'}
          </DialogDescription>
        </DialogHeader>

        {isSale ? (
          <form onSubmit={saleForm.handleSubmit(onSaleSubmit)} className="space-y-4">
            {/* Nom (affichage en lecture seule) */}
            <div className="space-y-2">
              <Label>{t('transactions.article')}</Label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium border">
                {transaction.name}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('transactions.article')} {t('common.required')}
              </p>
            </div>

            {/* Quantité */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantité (optionnel)
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                  placeholder={t('transactions.quantityPlaceholder')}
                {...saleForm.register('quantity')}
                className={cn(
                  saleForm.formState.errors.quantity && 'border-destructive'
                )}
              />
              <p className="text-xs text-muted-foreground">
                {t('common.available')}: {transaction.quantity || 0}
              </p>
              {saleForm.formState.errors.quantity && (
                <p className="text-sm text-destructive">
                  {saleForm.formState.errors.quantity.message}
                </p>
              )}
            </div>

            {/* Prix de vente */}
            <div className="space-y-2">
                <Label htmlFor="sale_price">
                  {t('transactions.salePriceLabel')}
                </Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min="0"
                  placeholder={t('products.pricePlaceholder')}
                {...saleForm.register('sale_price')}
                className={cn(
                  saleForm.formState.errors.sale_price && 'border-destructive'
                )}
              />
              <p className="text-xs text-muted-foreground">
                {t('products.unitPrice')}: {formatCurrency(transaction.sale_price || transaction.unit_price || 0)} {currency}
              </p>
              {saleForm.formState.errors.sale_price && (
                <p className="text-sm text-destructive">
                  {saleForm.formState.errors.sale_price.message}
                </p>
              )}
            </div>

            {/* Montant calculé */}
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <Label>{t('transactions.calculatedAmount')}</Label>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(calculatedAmount)} {currency}
              </div>
              {quantityChanged && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>La quantité a changé, le stock sera ajusté</span>
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saleForm.formState.isSubmitting}
              >
                {saleForm.formState.isSubmitting ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-4">
            {/* Nom */}
            <div className="space-y-2">
              <Label htmlFor="expense_name">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expense_name"
                type="text"
                placeholder="Ex: Achat de fournitures"
                {...expenseForm.register('name')}
                className={cn(
                  expenseForm.formState.errors.name && 'border-destructive'
                )}
              />
              {expenseForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {expenseForm.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Montant */}
            <div className="space-y-2">
                <Label htmlFor="amount">
                  {t('transactions.expenseAmountLabel')} ({t('common.optional')})
                </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                  placeholder={t('transactions.expenseAmountPlaceholder')}
                {...expenseForm.register('amount')}
                className={cn(
                  expenseForm.formState.errors.amount && 'border-destructive'
                )}
              />
              <p className="text-xs text-muted-foreground">
                Montant actuel : {formatCurrency(transaction.amount || 0)} {currency}
              </p>
              {expenseForm.formState.errors.amount && (
                <p className="text-sm text-destructive">
                  {expenseForm.formState.errors.amount.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={expenseForm.formState.isSubmitting}
              >
                {expenseForm.formState.isSubmitting ? t('common.loading') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
