'use client'

import React, { useState, useEffect, useMemo } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getArticles } from '@/lib/services/articles'
import type { Article, Variation } from '@/lib/services/articles'
import api from '@/lib/api'
import type { Transaction } from './transaction-card'
import { ArticleCombobox, type SearchOption } from './article-combobox'
import { useAnalyticsRefresh } from '@/lib/hooks/use-analytics-refresh'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { isSilentError } from '@/lib/utils/error-handler'
import { useCurrency } from '@/lib/utils/currency'

// Interface Article étendue avec variations (ID en string pour compatibilité)
interface ArticleWithVariations extends Omit<Article, 'id'> {
  id: string | number
  variations?: Variation[]
}

// Fonction pour créer le schéma de validation pour une vente
const createSaleSchema = (t: (key: string, params?: Record<string, string | number>) => string) => z.object({
  article_id: z
    .string()
    .min(1, t('transactions.validation.articleRequired')),
  variable_id: z
    .string()
    .optional()
    .nullable(),
  quantity: z
    .string()
    .min(1, t('transactions.validation.quantityRequired'))
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: t('transactions.validation.quantityMin'),
    }),
  sale_price: z
    .string()
    .optional()
    .transform((val) => val === '' || val === undefined ? undefined : parseFloat(val))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: t('transactions.validation.salePricePositive'),
    }),
})

// Fonction pour créer le schéma de validation pour une dépense
const createExpenseSchema = (t: (key: string, params?: Record<string, string | number>) => string) => z.object({
  name: z
    .string()
    .min(1, t('transactions.validation.nameRequired'))
    .min(2, t('transactions.validation.nameMin')),
  amount: z
    .string()
    .min(1, t('transactions.validation.amountRequired'))
    .transform((val) => parseFloat(val))
    .refine((val) => !isNaN(val) && val >= 0, {
      message: t('transactions.validation.amountPositive'),
    })
    .refine((val) => val >= 0.01, {
      message: t('transactions.validation.amountMin'),
    }),
})


interface AddTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (transaction: Transaction) => void
  defaultTab?: 'sale' | 'expense'
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
 * Dialog pour ajouter une transaction (vente ou dépense)
 */
export function AddTransactionDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultTab = 'sale',
}: AddTransactionDialogProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [transactionType, setTransactionType] = useState<'sale' | 'expense'>(defaultTab)
  
  // Mettre à jour le type quand defaultTab change ou quand le dialog s'ouvre
  React.useEffect(() => {
    if (open) {
      setTransactionType(defaultTab)
    }
  }, [open, defaultTab])
  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([])
  const [selectedOption, setSelectedOption] = useState<SearchOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingArticles, setLoadingArticles] = useState(false)
  const { refreshAnalytics } = useAnalyticsRefresh()

  // Créer les schémas avec la fonction de traduction
  const saleSchema = createSaleSchema(t)
  const expenseSchema = createExpenseSchema(t)

  // Formulaire pour une vente
  const saleForm = useForm({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      article_id: '',
      variable_id: null as string | null,
      quantity: '',
      sale_price: '',
    },
  })

  // Formulaire pour une dépense
  const expenseForm = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      name: '',
      amount: '',
    },
  })

  // Charger les articles quand la modale s'ouvre pour une vente
  useEffect(() => {
    if (open && transactionType === 'sale') {
      fetchArticles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionType])

  // Réinitialiser les formulaires quand on change de type
  useEffect(() => {
    if (open) {
      if (transactionType === 'sale') {
        saleForm.reset({
          article_id: '',
          variable_id: null,
          quantity: '',
          sale_price: '',
        })
        setSelectedOption(null)
      } else {
        expenseForm.reset({
          name: '',
          amount: '',
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionType, open])

  // Préparer les options de recherche
  const prepareSearchOptions = (articlesData: ArticleWithVariations[]): SearchOption[] => {
    const options: SearchOption[] = []
    
    articlesData.forEach(article => {
      if (article.type === 'simple') {
        // Article simple : une seule option
        options.push({
          id: `article-${article.id}`,
          label: `${article.name} (Quantité restante: ${article.remaining_quantity})`,
          articleId: String(article.id),
          variableId: null,
          article: {
            id: article.id,
            name: article.name,
            sale_price: article.sale_price,
            type: article.type,
          },
          remainingQuantity: article.remaining_quantity,
        })
      } else if (article.type === 'variable' && article.variations) {
        // Article variable : une option par variation
        article.variations.forEach(variation => {
          options.push({
            id: `variation-${variation.id}`,
            label: `${article.name} - ${variation.name} (Quantité restante: ${variation.remaining_quantity})`,
            articleId: String(article.id),
            variableId: variation.id,
            article: {
              id: article.id,
              name: article.name,
              sale_price: article.sale_price,
              type: article.type,
            },
            variation: variation,
            remainingQuantity: variation.remaining_quantity,
          })
        })
      }
    })
    
    return options
  }

  const fetchArticles = async () => {
    try {
      setLoadingArticles(true)
      const data = await getArticles()
      // Convertir les IDs en string pour la compatibilité
      const articlesWithStringIds = data.map(article => ({
        ...article,
        id: String(article.id),
      })) as unknown as ArticleWithVariations[]
      
      // Préparer les options de recherche
      const options = prepareSearchOptions(articlesWithStringIds)
      setSearchOptions(options)
    } catch (error) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        return
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur lors du chargement des articles:', error)
      }
      toast.error(t('errors.loading'))
    } finally {
      setLoadingArticles(false)
    }
  }

  // Gérer la sélection d'une option
  const handleSelectOption = (option: SearchOption | null) => {
    setSelectedOption(option)
    
    if (option) {
      // Définir les valeurs du formulaire
      saleForm.setValue('article_id', option.articleId)
      saleForm.setValue('variable_id', option.variableId || null)
      
      // Définir le prix par défaut
      saleForm.setValue('sale_price', option.article.sale_price.toString())
      
      // Réinitialiser la quantité
      saleForm.setValue('quantity', '1')
    } else {
      // Réinitialiser si aucune option sélectionnée
      saleForm.setValue('article_id', '')
      saleForm.setValue('variable_id', null)
      saleForm.setValue('sale_price', '')
      saleForm.setValue('quantity', '')
    }
  }

  // Observer les valeurs du formulaire pour calculer amount en temps réel
  const watchedQuantity = saleForm.watch('quantity')
  const watchedSalePrice = saleForm.watch('sale_price')

  // Calculer le montant en temps réel pour les ventes
  const calculatedAmount = useMemo(() => {
    if (transactionType !== 'sale' || !selectedOption) return 0
    
    const quantity = watchedQuantity ? (typeof watchedQuantity === 'string' ? parseInt(watchedQuantity, 10) : watchedQuantity) : 0
    const salePrice = watchedSalePrice ? (typeof watchedSalePrice === 'string' ? parseFloat(watchedSalePrice) : watchedSalePrice) : selectedOption.article.sale_price
    
    return quantity * salePrice
  }, [transactionType, selectedOption, watchedQuantity, watchedSalePrice])

  // Obtenir la quantité disponible
  const getAvailableQuantity = (): number => {
    if (!selectedOption) return 0
    return selectedOption.remainingQuantity
  }

  // Gérer la soumission d'une vente
  const onSaleSubmit = async (data: z.infer<typeof saleSchema>) => {
    try {
      setLoading(true)

      // Vérifier qu'une option est sélectionnée
      if (!selectedOption) {
        toast.error(t('transactions.validation.articleRequired'))
        saleForm.setError('article_id', {
          message: t('transactions.validation.articleRequired'),
        })
        return
      }

      // Vérifier la quantité disponible
      const availableQuantity = getAvailableQuantity()
      const requestedQuantity = typeof data.quantity === 'string' ? parseInt(data.quantity, 10) : data.quantity
      
      if (requestedQuantity > availableQuantity) {
        toast.error(t('transactions.validation.insufficientQuantity', { quantity: availableQuantity }))
        saleForm.setError('quantity', {
          message: t('transactions.validation.insufficientQuantity', { quantity: availableQuantity }),
        })
        return
      }

      // Préparer le payload
      const payload: {
        type: 'sale'
        article_id: string
        variable_id?: string | null
        quantity: number
        sale_price?: number
      } = {
        type: 'sale',
        article_id: selectedOption.articleId,
        quantity: typeof data.quantity === 'string' ? parseInt(data.quantity, 10) : data.quantity,
      }

      // Ajouter variable_id si c'est une variation
      if (selectedOption.variableId) {
        payload.variable_id = selectedOption.variableId
      } else {
        payload.variable_id = null
      }

      // Ajouter sale_price seulement si différent du prix par défaut
      if (data.sale_price !== undefined) {
        const salePrice = typeof data.sale_price === 'string' ? parseFloat(data.sale_price) : data.sale_price
        if (salePrice !== selectedOption.article.sale_price) {
          payload.sale_price = salePrice
        }
      }

      console.log('📤 Envoi POST /api/transactions (vente):', payload)

      const response = await api.post<{
        success: boolean
        message: string
        data: {
          id: string | number
          name: string
          quantity?: number | null
          amount: number
          sale_price?: number | null
          type: 'sale' | 'expense'
          created_at: string
        }
      }>('/api/transactions', payload)

      console.log('📥 Réponse API:', response.data)

      if (response.data.success && response.data.data) {
        // Mapper la transaction API vers le format frontend
        const transaction: Transaction = {
          id: String(response.data.data.id),
          type: 'sale',
          name: response.data.data.name || '',
          quantity: response.data.data.quantity || null,
          unit_price: response.data.data.sale_price || null,
          sale_price: response.data.data.sale_price || null,
          amount: response.data.data.amount,
          date: response.data.data.created_at || new Date().toISOString(),
        }

        toast.success(t('transactions.success.saleAdded'))
        
        // Recharger les statistiques wallet
        if (typeof window !== 'undefined') {
          const reloadFn = (window as { reloadWalletStats?: () => void }).reloadWalletStats
          if (reloadFn) {
            reloadFn()
          }
        }
        
        // Rafraîchir les Analytics
        refreshAnalytics()
        
        onSuccess(transaction)
        saleForm.reset()
        setSelectedOption(null)
        onOpenChange(false)
      }
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        return
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur lors de l\'ajout de la vente:', error)
      }
      
      const axiosError = error as { response?: { status?: number; data?: { errors?: Record<string, string | string[]>; message?: string } } }
      
      if (axiosError.response?.status === 422) {
        const errors = axiosError.response.data?.errors || {}
        Object.keys(errors).forEach((key) => {
          const field = key as 'article_id' | 'variable_id' | 'quantity' | 'sale_price'
          if (field) {
            saleForm.setError(field, {
              message: Array.isArray(errors[key]) ? errors[key][0] : String(errors[key]),
            })
          }
        })
      } else if (axiosError.response?.status === 400) {
        const message = axiosError.response.data?.message || t('errors.loading')
        toast.error(message)
      } else if (axiosError.response?.status === 403) {
        toast.error(t('transactions.validation.articleNotFound'))
      } else {
        toast.error(t('errors.loading'))
      }
    } finally {
      setLoading(false)
    }
  }

  // Gérer la soumission d'une dépense
  const onExpenseSubmit = async (data: z.infer<typeof expenseSchema>) => {
    try {
      setLoading(true)

      const payload = {
        type: 'expense' as const,
        name: data.name,
        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
      }

      console.log('📤 Envoi POST /api/transactions (dépense):', payload)

      const response = await api.post<{
        success: boolean
        message: string
        data: {
          id: string | number
          name: string
          quantity?: number | null
          amount: number
          sale_price?: number | null
          type: 'sale' | 'expense'
          created_at: string
        }
      }>('/api/transactions', payload)

      console.log('📥 Réponse API:', response.data)

      if (response.data.success && response.data.data) {
        // Mapper la transaction API vers le format frontend
        const transaction: Transaction = {
          id: String(response.data.data.id),
          type: 'expense',
          name: response.data.data.name || '',
          amount: response.data.data.amount,
          date: response.data.data.created_at || new Date().toISOString(),
        }

        toast.success(t('transactions.success.expenseAdded'))
        
        // Recharger les statistiques wallet
        if (typeof window !== 'undefined') {
          const reloadFn = (window as { reloadWalletStats?: () => void }).reloadWalletStats
          if (reloadFn) {
            reloadFn()
          }
        }
        
        // Rafraîchir les Analytics
        refreshAnalytics()
        
        onSuccess(transaction)
        expenseForm.reset()
        onOpenChange(false)
      }
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        return
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur lors de l\'ajout de la dépense:', error)
      }
      
      const axiosError = error as { response?: { status?: number; data?: { errors?: Record<string, string | string[]>; message?: string } } }
      
      if (axiosError.response?.status === 422) {
        const errors = axiosError.response.data?.errors || {}
        Object.keys(errors).forEach((key) => {
          const field = key as 'name' | 'amount'
          if (field) {
            expenseForm.setError(field, {
              message: Array.isArray(errors[key]) ? errors[key][0] : String(errors[key]),
            })
          }
        })
      } else if (axiosError.response?.status === 400) {
        const message = axiosError.response.data?.message || t('errors.loading')
        toast.error(message)
      } else {
        toast.error(t('errors.loading'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('transactions.addTransactionTitle')}</DialogTitle>
          <DialogDescription>
            {t('transactions.addTransactionDescription')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={transactionType} onValueChange={(v) => setTransactionType(v as 'sale' | 'expense')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sale">{t('transactions.sale')}</TabsTrigger>
            <TabsTrigger value="expense">{t('transactions.expense')}</TabsTrigger>
          </TabsList>

          <TabsContent value="sale" className="space-y-4">
            <form onSubmit={saleForm.handleSubmit(onSaleSubmit)} className="space-y-4">
              {/* Barre de recherche d'article/variation */}
              <div className="space-y-2">
                <Label>
                  {t('transactions.searchArticle')} <span className="text-destructive">*</span>
                </Label>
                {loadingArticles ? (
                  <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                    {t('transactions.loadingArticles')}
                  </div>
                ) : (
                  <ArticleCombobox
                    options={searchOptions}
                    value={selectedOption}
                    onSelect={handleSelectOption}
                    placeholder={t('transactions.searchArticlePlaceholder')}
                    emptyMessage={t('transactions.noArticleFound')}
                    disabled={loadingArticles}
                    className={cn(
                      saleForm.formState.errors.article_id && 'border-destructive'
                    )}
                  />
                )}
                {selectedOption && (
                  <p className="text-xs text-muted-foreground">
                    {t('common.selected')}: {selectedOption.label}
                  </p>
                )}
                {saleForm.formState.errors.article_id && (
                  <p className="text-sm text-destructive">
                    {saleForm.formState.errors.article_id.message}
                  </p>
                )}
              </div>

              {/* Quantité */}
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  {t('transactions.quantityLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={getAvailableQuantity()}
                  placeholder={t('transactions.quantityPlaceholder')}
                  {...saleForm.register('quantity')}
                  className={cn(
                    saleForm.formState.errors.quantity && 'border-destructive'
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t('common.available')}: {getAvailableQuantity()}
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
                  placeholder={selectedOption?.article.sale_price?.toString() || "0"}
                  {...saleForm.register('sale_price')}
                  className={cn(
                    saleForm.formState.errors.sale_price && 'border-destructive'
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {t('common.defaultPrice')}: {formatCurrency(selectedOption?.article.sale_price || 0)} {currency}
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
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || loadingArticles}
                >
                  {loading ? t('common.loading') : t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="expense" className="space-y-4">
            <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-4">
              {/* Nom de la dépense */}
              <div className="space-y-2">
                <Label htmlFor="expense_name">
                  {t('transactions.expenseNameLabel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expense_name"
                  type="text"
                  placeholder={t('transactions.expenseNamePlaceholder')}
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
                  {t('transactions.expenseAmountLabel')} <span className="text-destructive">*</span>
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
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                >
                  {loading ? t('common.loading') : t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

