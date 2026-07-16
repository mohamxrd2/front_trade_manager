'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Package, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getArticles, type Article } from '@/lib/services/articles'
import { useInvoiceForm } from './invoice-form-context'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

export function StepItems() {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const { formData, addItem, removeItem, updateItem, subtotal } = useInvoiceForm()
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchArticles()
  }, [])

  const fetchArticles = async () => {
    setIsLoading(true)
    try {
      const data = await getArticles()
      setArticles(data)
    } catch (error) {
      console.error('Error fetching articles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleArticleChange = (itemId: string, articleId: string) => {
    const article = articles.find((a) => String(a.id) === articleId) || null
    updateItem(itemId, {
      article,
      unitPrice: article?.sale_price || 0,
    })
  }

  const handleQuantityChange = (itemId: string, quantity: number) => {
    updateItem(itemId, { quantity: Math.max(1, quantity) })
  }

  // Check stock availability
  const getStockWarning = (item: typeof formData.items[0]) => {
    if (!item.article) return null
    if (item.quantity > item.article.remaining_quantity) {
      return t('invoices.stockInsufficient', { 
        available: item.article.remaining_quantity 
      })
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Liste des articles */}
      <div className="space-y-4">
        {formData.items.map((item, index) => {
          const stockWarning = getStockWarning(item)

          return (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Numéro de ligne */}
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-medium shrink-0 mt-6">
                    {index + 1}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Article */}
                      <div className="md:col-span-2 space-y-2">
                        <Label>{t('invoices.article')}</Label>
                        <Select
                          value={item.article ? String(item.article.id) : ''}
                          onValueChange={(value) => handleArticleChange(item.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('invoices.selectArticle')} />
                          </SelectTrigger>
                          <SelectContent>
                            {articles.map((article) => (
                              <SelectItem key={article.id} value={String(article.id)}>
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <span>{article.name}</span>
                                  <span className="text-muted-foreground">
                                    ({article.remaining_quantity} {t('common.units')})
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantité */}
                      <div className="space-y-2">
                        <Label>{t('invoices.quantity')}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                        />
                      </div>

                      {/* Prix unitaire */}
                      <div className="space-y-2">
                        <Label>{t('invoices.unitPrice')}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    {/* Warning stock */}
                    {stockWarning && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{stockWarning}</AlertDescription>
                      </Alert>
                    )}

                    {/* Total ligne */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">{t('invoices.lineTotal')}</span>
                      <span className="font-semibold">
                        {formatCurrency(item.total)} {currency}
                      </span>
                    </div>
                  </div>

                  {/* Bouton supprimer */}
                  {formData.items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive shrink-0 mt-6"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bouton ajouter */}
      <Button variant="outline" onClick={addItem} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        {t('invoices.addArticle')}
      </Button>

      {/* Sous-total */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{t('invoices.subtotal')}</span>
            <span className="text-xl font-bold">
              {formatCurrency(subtotal)} {currency}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

