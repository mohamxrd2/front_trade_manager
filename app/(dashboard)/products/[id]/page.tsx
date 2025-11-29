'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useArticle } from '@/lib/hooks/useArticles'
import { 
  ArrowLeft, 
  Package, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  Plus,
  ShoppingCart,
  BarChart3,
  Layers,
  Calendar,
  Tag,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { articleToProduct } from '@/components/products/product-card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { EditVariationDialog } from '@/components/products/edit-variation-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { type ApiTransaction } from '@/lib/services/transactions'
import { createVariation, getVariations, deleteVariation, type Variation } from '@/lib/services/variations'
import { deleteArticle, type Article } from '@/lib/services/articles'
import { invalidateArticles, invalidateUserStats } from '@/lib/hooks/useCache'
import { EditArticleDialog } from '@/components/products/edit-article-dialog'
import api from '@/lib/api'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import { useCurrency } from '@/lib/utils/currency';
dayjs.locale('fr')

/**
 * Page de détail d'un produit - Design moderne et complet
 */
export default function ProductDetailPage() {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  // Récupérer l'article avec SWR
  const { article, error, isLoading, mutate: mutateArticle } = useArticle(productId)

  // États pour les transactions et variations
  const [transactions, setTransactions] = useState<ApiTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [variations, setVariations] = useState<Variation[]>([])
  const [loadingVariations, setLoadingVariations] = useState(false)
  const [addVariationOpen, setAddVariationOpen] = useState(false)
  const [variationForm, setVariationForm] = useState({
    name: '',
    quantity: '',
  })
  const [submittingVariation, setSubmittingVariation] = useState(false)
  
  // États pour la pagination des transactions
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // États pour la suppression d'article
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // États pour la modification d'article
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // États pour la modification et suppression de variations
  const [editingVariation, setEditingVariation] = useState<Variation | null>(null)
  const [editVariationDialogOpen, setEditVariationDialogOpen] = useState(false)
  const [deleteVariationDialogOpen, setDeleteVariationDialogOpen] = useState(false)
  const [variationToDelete, setVariationToDelete] = useState<Variation | null>(null)

  // Charger les transactions de vente et les variations pour cet article
  useEffect(() => {
    if (productId && article) {
      fetchTransactions()
      if (article.type === 'variable') {
        fetchVariations()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, article?.id, article?.type])

  // Réinitialiser à la page 1 quand les transactions changent
  useEffect(() => {
    setCurrentPage(1)
  }, [transactions.length])

  const fetchTransactions = async () => {
    setLoadingTransactions(true)
    try {
      const response = await api.get<{ success: boolean; data: ApiTransaction[] }>('/api/transactions')
      if (response.data.data) {
        const filtered = response.data.data.filter(
          (t: ApiTransaction) => String(t.article_id) === String(productId) && t.type === 'sale'
        )
        filtered.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime()
          const dateB = new Date(b.created_at).getTime()
          return dateB - dateA
        })
        setTransactions(filtered)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des transactions:', error)
      toast.error(t('errors.loading'))
    } finally {
      setLoadingTransactions(false)
    }
  }

  const fetchVariations = async () => {
    setLoadingVariations(true)
    try {
      const variationsData = await getVariations(productId)
      setVariations(variationsData)
    } catch (error) {
      console.error('Erreur lors du chargement des variations:', error)
      toast.error(t('errors.loading'))
    } finally {
      setLoadingVariations(false)
    }
  }

  const handleAddVariationSubmit = async () => {
    if (!variationForm.name.trim()) {
      toast.error(t('common.required'))
      return
    }

    const quantityNum = parseInt(variationForm.quantity)
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error(t('products.quantityMustBePositive'))
      return
    }

    if (!article) return

    const totalVariationsQuantity = variations.reduce(
      (sum, v) => sum + v.quantity,
      0
    )
    const availableQuantity = article.quantity - totalVariationsQuantity

    if (quantityNum > availableQuantity) {
      toast.error(t('products.quantityExceedsAvailable', { available: availableQuantity }))
      return
    }

    setSubmittingVariation(true)
    try {
      await createVariation({
        article_id: String(article.id),
        name: variationForm.name,
        quantity: quantityNum,
        image: null,
      })

      toast.success(t('success.variationAdded'))
      setVariationForm({ name: '', quantity: '' })
      setAddVariationOpen(false)
      await mutateArticle()
      await fetchVariations()
    } catch (error: unknown) {
      const errorObj = error as { message?: string; validationErrors?: Record<string, string[]> }
      if (errorObj.validationErrors) {
        const firstError = Object.values(errorObj.validationErrors)[0]
        toast.error(firstError?.[0] || t('errors.loading'))
      } else {
        toast.error(errorObj.message || t('errors.loading'))
      }
    } finally {
      setSubmittingVariation(false)
    }
  }

  // Fonction de suppression d'article
  const handleDeleteArticle = async () => {
    if (!article || !productId) return

    setDeleting(true)
    try {
      await deleteArticle(productId)
      
      // Invalider les caches pour mettre à jour la liste des produits et les statistiques
      await Promise.all([
        invalidateArticles(),
        invalidateUserStats(),
      ])
      
      toast.success(t('products.articleDeleted'))
      
      // Rediriger vers la liste des produits
      router.push('/products')
    } catch (error: unknown) {
      const errorObj = error as { message?: string }
      const errorMessage = errorObj.message || t('products.errorDeletingArticle')
      
      toast.error(errorMessage)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  // Fonction de modification d'article
  const handleEditSuccess = async (updatedArticle: Article) => {
    // Mettre à jour l'article dans le cache SWR
    await mutateArticle()
    
    // Invalider les caches pour mettre à jour la liste des produits et les statistiques
    await Promise.all([
      invalidateArticles(),
      invalidateUserStats(),
    ])
    
    // Recharger les variations si l'article est variable
    if (updatedArticle.type === 'variable') {
      await fetchVariations()
    }
  }

  // Fonction pour gérer la modification d'une variation
  const handleEditVariationSuccess = async (updatedVariation: Variation) => {
    // Mettre à jour la variation dans la liste locale
    setVariations(variations.map(v => v.id === updatedVariation.id ? updatedVariation : v))
    setEditVariationDialogOpen(false)
    setEditingVariation(null)
    
    // Recharger l'article pour avoir les données à jour
    await mutateArticle()
    
    // Recharger les variations
    await fetchVariations()
    
    toast.success(t('products.variationUpdated'))
  }

  // Fonction pour gérer la suppression d'une variation
  const handleDeleteVariation = async () => {
    if (!variationToDelete) return

    try {
      await deleteVariation(variationToDelete.id)
      
      // Retirer la variation de la liste locale
      setVariations(variations.filter(v => v.id !== variationToDelete.id))
      
      // Recharger l'article pour avoir les données à jour
      await mutateArticle()
      
      // Recharger les variations
      await fetchVariations()
      
      toast.success(t('success.variationDeleted'))
      setDeleteVariationDialogOpen(false)
      setVariationToDelete(null)
    } catch (error: unknown) {
      const errorObj = error as { message?: string }
      toast.error(errorObj.message || t('errors.loading'))
    }
  }

  // Vérifier que l'article existe et est valide
  const isValidArticle = article && typeof article === 'object' && 'id' in article && 'name' in article

  // Gestion des erreurs
  if (error) {
    const isAuthError = error.message.includes('Non authentifié')
    
    if (isAuthError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">{t('errors.redirecting')}</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/products')}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errors.loading')}</AlertTitle>
          <AlertDescription>
            {error.message || t('products.errorLoadingProduct')}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // État de chargement
  if (isLoading || !isValidArticle) {
    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/products')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="h-6 w-48 bg-muted animate-pulse rounded mb-2" />
              <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="h-24 bg-muted animate-pulse rounded" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-20 bg-muted animate-pulse rounded" />
                <div className="h-20 bg-muted animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-20 bg-muted animate-pulse rounded" />
              <div className="h-20 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const product = articleToProduct(article!)
  const totalQuantity = (product.quantity_sold || 0) + (product.quantity_remaining || 0)
  const stockPercentage = article!.sales_percentage !== undefined && article!.sales_percentage !== null
    ? article!.sales_percentage
    : totalQuantity > 0 
      ? ((product.quantity_remaining || 0) / totalQuantity) * 100 
      : 0

  const totalValue = (product.quantity_remaining || 0) * (product.price || 0)
  const totalSales = (product.quantity_sold || 0) * (product.price || 0)

  const getStockStatus = () => {
    if ((product.quantity_remaining || 0) === 0) {
      return { 
        label: t('products.stockStatus.outOfStock'), 
        variant: 'destructive' as const,
        color: 'red'
      }
    }
    if (article!.low_stock) {
      return { 
        label: t('products.stockStatus.lowStock'), 
        variant: 'secondary' as const,
        color: 'orange'
      }
    }
    return { 
      label: t('products.stockStatus.inStock'), 
      variant: 'default' as const,
      color: 'green'
    }
  }

  const stockStatus = getStockStatus()
  const totalVariationsQuantity = variations.reduce((sum, v) => sum + v.quantity, 0)
  const availableQuantityForVariations = (article?.quantity || 0) - totalVariationsQuantity

  // Formatage
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fr-FR').format(value)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Format de date "12 MAI 2025"
  const formatDate = (dateString: string) => {
    return dayjs(dateString).format('DD MMMM YYYY');
  }

  // Calculs de pagination
  const totalPages = Math.ceil(transactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = transactions.slice(startIndex, endIndex)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 lg:px-6 py-8 space-y-8">
        {/* Header moderne */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/products')}
              className="h-10 w-10 hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('products.productId', { id: product.id })} • {product.type === 'simple' ? t('products.simpleArticleType') : t('products.variableArticleType')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setEditDialogOpen(true)}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </Button>
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('products.deleteArticleConfirm')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('products.deleteArticleDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteArticle}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? t('products.deleting') : t('products.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Stats principales en haut */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('products.unitPrice')}</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(product.price)} {currency}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('products.sold')}</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatNumber(product.quantity_sold)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('products.remaining')}</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatNumber(product.quantity_remaining)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Package className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('products.stock')}</p>
                  <p className="text-2xl font-bold mt-1">
                    {Math.round(stockPercentage)}%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations détaillées */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t('products.productInfo')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline"
                      className={cn(
                        "font-medium",
                        product.type === 'simple' 
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      )}
                    >
                      {product.type === 'simple' ? t('products.simple') : t('products.variable')}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "font-medium",
                        stockStatus.variant === 'destructive' && "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
                        stockStatus.variant === 'secondary' && "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
                        stockStatus.variant === 'default' && "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                      )}
                    >
                      {stockStatus.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Barre de progression du stock */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t('products.stockLevel')}</span>
                    <span className="text-sm font-bold">{Math.round(stockPercentage)}%</span>
                  </div>
                  <div className="relative w-full">
                    <div className="h-4 w-full rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-500 rounded-full",
                          stockPercentage === 0 && "bg-red-500",
                          stockPercentage > 0 && stockPercentage < 20 && "bg-orange-500",
                          stockPercentage >= 20 && stockPercentage < 50 && "bg-yellow-500",
                          stockPercentage >= 50 && "bg-green-500"
                        )}
                        style={{ width: `${stockPercentage}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('products.totalPieces', { total: formatNumber(totalQuantity) })}
                  </p>
                </div>

                {/* Alerte stock faible */}
                {article!.low_stock && (
                  <Alert className={cn(
                    product.quantity_remaining === 0
                      ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                      : "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
                  )}>
                    <AlertTriangle className={cn(
                      "h-4 w-4",
                      product.quantity_remaining === 0
                        ? "text-red-600"
                        : "text-orange-600"
                    )} />
                    <AlertTitle className={cn(
                      product.quantity_remaining === 0
                        ? "text-red-700"
                        : "text-orange-700"
                    )}>
                      {product.quantity_remaining === 0 ? t('products.outOfStock') : t('products.lowStock')}
                    </AlertTitle>
                    <AlertDescription className={cn(
                      product.quantity_remaining === 0
                        ? "text-red-600"
                        : "text-orange-600"
                    )}>
                      {product.quantity_remaining === 0
                        ? t('products.outOfStockDescription')
                        : t('products.lowStockDescription')}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Section Variations */}
            {article && article.type === 'variable' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      {t('products.variations')}
                    </CardTitle>
                    <Button onClick={() => setAddVariationOpen(true)} size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('common.add')}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingVariations ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">{t('common.loading')}</p>
                    </div>
                  ) : variations.length === 0 ? (
                    <div className="text-center py-8">
                      <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">{t('products.noVariationForArticle')}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {variations.map((variation) => (
                        <Card key={variation.id} className="border">
                          <CardContent className="p-4">
                            {/* Nom et badge */}
                            <div className="flex items-center justify-between mb-4 gap-3">
                              <h3 className="font-semibold text-base truncate flex-1" title={variation.name}>
                                {variation.name}
                              </h3>
                              {variation.remaining_quantity > 0 ? (
                                <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 whitespace-nowrap">
                                  {t('products.stockStatus.inStock')}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-400 whitespace-nowrap">
                                  {t('products.stockStatus.outOfStock')}
                                </Badge>
                              )}
                            </div>

                            {/* Statistiques simples */}
                            <div className="space-y-2 mb-4">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">{t('products.soldLabel')}</span>
                                <span className="text-sm font-semibold">{formatNumber(variation.sold_quantity)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">{t('products.remainingLabel')}</span>
                                <span className="text-sm font-semibold">{formatNumber(variation.remaining_quantity)}</span>
                              </div>
                            </div>

                            {/* Barre de progression */}
                            <div className="space-y-2 pt-3 border-t">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">{t('products.progress')}</span>
                                <span className="text-xs font-semibold">{variation.sales_percentage.toFixed(1)}%</span>
                              </div>
                              <Progress value={variation.sales_percentage} className="h-2" />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => {
                                  setEditingVariation(variation)
                                  setEditVariationDialogOpen(true)
                                }}
                                title={t('common.edit')}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setVariationToDelete(variation)
                                  setDeleteVariationDialogOpen(true)
                                }}
                                title={t('common.delete')}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Section Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {t('products.saleTransactions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTransactions ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">{t('common.loading')}</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">{t('products.noSaleTransactionForArticle')}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {t('products.date')}
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4" />
                              {t('products.variation')}
                            </div>
                          </TableHead>
                          <TableHead className="text-right">{t('products.quantity')}</TableHead>
                          <TableHead className="text-right">{t('products.unitPriceLabel')}</TableHead>
                          <TableHead className="text-right">{t('products.totalAmount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">
                              {formatDate(transaction.created_at)}
                            </TableCell>
                            <TableCell>
                              {transaction.variation ? (
                                <Badge variant="outline">{transaction.variation.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{transaction.quantity || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(transaction.sale_price || 0)} {currency}</TableCell>
                            <TableCell className="text-right font-semibold text-green-600">
                              {formatCurrency(transaction.amount)} {currency}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {/* Pagination */}
                {transactions.length > 0 && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {t('products.showingTransactions', { start: startIndex + 1, end: Math.min(endIndex, transactions.length), total: transactions.length })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {t('products.previous')}
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // Afficher seulement la première page, la dernière, la page actuelle et les pages adjacentes
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="min-w-[40px]"
                              >
                                {page}
                              </Button>
                            )
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return (
                              <span key={page} className="px-2 text-muted-foreground">
                                ...
                              </span>
                            )
                          }
                          return null
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        {t('products.next')}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Colonne latérale */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {t('products.financialValues')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">{t('products.stockValue')}</p>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalValue)} {currency}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(product.quantity_remaining)} × {formatCurrency(product.price)}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">{t('products.revenue')}</p>
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {formatCurrency(totalSales)} {currency}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(product.quantity_sold)} × {formatCurrency(product.price)}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{t('products.totalValue')}</p>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(totalValue + totalSales)} {currency}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('products.stockPlusSales')}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">{t('products.salesPercentage')}</p>
                  <p className="text-2xl font-bold">
                    {article!.sales_percentage ? article!.sales_percentage.toFixed(1) : '0.0'}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal d'ajout de variation */}
      <Dialog open={addVariationOpen} onOpenChange={setAddVariationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.addVariationTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variation-name">{t('products.variationNameLabel')}</Label>
              <Input
                id="variation-name"
                placeholder={t('products.variationNamePlaceholder')}
                value={variationForm.name}
                onChange={(e) => setVariationForm({ ...variationForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variation-quantity">{t('products.variationQuantityLabel')}</Label>
              <Input
                id="variation-quantity"
                type="number"
                min="1"
                max={availableQuantityForVariations}
                placeholder={t('products.variationQuantityPlaceholder')}
                value={variationForm.quantity}
                onChange={(e) =>
                  setVariationForm({ ...variationForm, quantity: e.target.value })
                }
              />
              <p className="text-sm text-muted-foreground">
                {t('products.availableQuantity', { quantity: formatNumber(availableQuantityForVariations) })}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAddVariationOpen(false)
                  setVariationForm({ name: '', quantity: '' })
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddVariationSubmit} disabled={submittingVariation}>
                {submittingVariation ? t('products.adding') : t('products.add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modale de modification d'article */}
      <EditArticleDialog
        article={article || null}
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Modale de modification de variation */}
      {editingVariation && article && (
        <EditVariationDialog
          variation={editingVariation}
          article={article}
          open={editVariationDialogOpen}
          onClose={() => {
            setEditVariationDialogOpen(false)
            setEditingVariation(null)
          }}
          onSuccess={handleEditVariationSuccess}
        />
      )}

      {/* Dialogue de confirmation de suppression de variation */}
      <AlertDialog open={deleteVariationDialogOpen} onOpenChange={setDeleteVariationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.deleteVariationTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('products.deleteVariationDescription', { name: variationToDelete?.name || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVariation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('products.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
