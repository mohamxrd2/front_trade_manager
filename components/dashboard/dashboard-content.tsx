'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, ArrowRight } from 'lucide-react'
import { AddTransactionDialog } from '@/components/wallet/add-transaction-dialog'
import { TransactionCard, type Transaction } from '@/components/wallet/transaction-card'
import { getTransactions } from '@/lib/services/transactions'
import { getCategoryAnalysis } from '@/lib/services/analytics'
import { addArticle } from '@/lib/services/articles'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'

// Schéma pour ajouter un produit
const productSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  sale_price: z.string().min(1, 'Le prix est obligatoire').transform((val) => parseFloat(val)),
  quantity: z.string().min(1, 'La quantité est obligatoire').transform((val) => parseInt(val, 10)),
  type: z.enum(['simple', 'variable']),
})

type ProductFormData = z.infer<typeof productSchema>

// Fonction utilitaire pour formater la monnaie
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function DashboardContent() {
  const router = useRouter()
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [transactionType, setTransactionType] = useState<'sale' | 'expense'>('sale')

  // Récupérer les transactions récentes (limité à 5)
  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['dashboard-transactions'],
    queryFn: async () => {
      const data = await getTransactions()
      return data.slice(0, 5) // Limiter à 5 transactions
    },
    staleTime: 30 * 1000, // 30 secondes
  })

  // Récupérer les données pour le graphique Top 5 produits
  const { data: categoryData, isLoading: isLoadingCategory } = useQuery({
    queryKey: ['dashboard-category-analysis', { period: '30' }],
    queryFn: () => getCategoryAnalysis({ period: '30' }),
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  // Formulaire pour ajouter un produit
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sale_price: '',
      quantity: '',
      type: 'simple',
    },
  })

  const handleAddTransaction = (type: 'sale' | 'expense') => {
    setTransactionType(type)
    setTransactionDialogOpen(true)
    // Le dialog gère son propre état de type, on peut le forcer via un effet
  }

  const handleTransactionSuccess = () => {
    setTransactionDialogOpen(false)
  }

  const handleAddProduct = async (data: ProductFormData) => {
    try {
      await addArticle({
        name: data.name.trim(),
        sale_price: data.sale_price,
        quantity: data.quantity,
        type: data.type,
        image: null,
      })
      toast.success(t('success.productAdded'))
      setProductDialogOpen(false)
      reset()
      router.refresh()
    } catch (error) {
      toast.error(t('common.error'))
    }
  }

  // Préparer les données pour le graphique Top 5 produits
  const barData = categoryData?.top_products.slice(0, 5).map((product) => ({
    product: product.name,
    quantity: product.total_quantity,
    amount: product.total_amount,
  })) || []

  const barChartConfig: ChartConfig = {
    quantity: {
      label: t('products.quantity'),
      color: '#3b82f6', // Bleu
    },
  } satisfies ChartConfig

  const totalQuantity = barData.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = barData.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-4 lg:px-6 py-6">
      {/* Colonne 1/3 : Actions rapides + Graphiques */}
      <div className="lg:col-span-1 space-y-6">
        {/* Actions rapides */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              onClick={() => handleAddTransaction('sale')}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.addSale')}
            </Button>
            <Button
              onClick={() => handleAddTransaction('expense')}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.addExpense')}
            </Button>
            <Button
              onClick={() => setProductDialogOpen(true)}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {t('dashboard.addProduct')}
            </Button>
          </CardContent>
        </Card>

        {/* Graphique Top 5 Produits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.topProducts')}</CardTitle>
            <CardDescription className="text-xs">
              {t('dashboard.topProductsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCategory ? (
              <Skeleton className="h-64 w-full" />
            ) : barData.length > 0 ? (
              <ChartContainer config={barChartConfig}>
                <BarChart
                  accessibilityLayer
                  data={barData}
                  layout="vertical"
                  margin={{ left: 0 }}
                >
                  <YAxis
                    dataKey="product"
                    type="category"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    width={120}
                    fontSize={12}
                  />
                  <XAxis dataKey="quantity" type="number" hide />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar
                    dataKey="quantity"
                    layout="vertical"
                    radius={5}
                    fill="var(--color-quantity)"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                {t('common.noData')}
              </div>
            )}
          </CardContent>
          {barData.length > 0 && (
            <CardFooter className="flex-col items-start gap-2 text-xs pt-3">
              <div className="flex gap-2 leading-none font-medium">
                {t('dashboard.total')}: {totalQuantity} {t('common.units')} {t('common.sold')}
                {totalAmount > 0 && <TrendingUp className="h-3 w-3 text-green-600" />}
              </div>
              <div className="text-muted-foreground leading-none">
                {t('dashboard.totalAmount')}: {formatCurrency(totalAmount)} {currency}
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Colonne 2/3 : Transactions récentes */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('dashboard.recentTransactions')}</CardTitle>
                <CardDescription>
                  {t('dashboard.recentTransactionsDescription')}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/wallet">
                  {t('common.viewAll')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    onEdit={() => {
                      // Rediriger vers la page wallet pour éditer
                      router.push('/wallet')
                    }}
                    onDelete={() => {
                      // Rediriger vers la page wallet pour supprimer
                      router.push('/wallet')
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('dashboard.noRecentTransactions')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog pour ajouter une transaction */}
      <AddTransactionDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        onSuccess={handleTransactionSuccess}
        defaultTab={transactionType}
      />

      {/* Dialog pour ajouter un produit */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('products.addNewProduct')}</DialogTitle>
            <DialogDescription>
              {t('products.addProductDescription')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleAddProduct)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('products.productName')} *</Label>
                <Input
                  id="name"
                  placeholder={t('products.productNamePlaceholder')}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{t('products.type')} *</Label>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('common.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">{t('products.simple')}</SelectItem>
                        <SelectItem value="variable">{t('products.variable')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.type && (
                  <p className="text-sm text-red-500">{errors.type.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sale_price">{t('products.salePrice')} ({currency}) *</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  placeholder={t('products.pricePlaceholder')}
                  {...register('sale_price')}
                />
                {errors.sale_price && (
                  <p className="text-sm text-red-500">{errors.sale_price.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">{t('products.quantityInStock')} *</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder={t('products.quantityPlaceholder')}
                  {...register('quantity')}
                />
                {errors.quantity && (
                  <p className="text-sm text-red-500">{errors.quantity.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProductDialogOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.loading') : t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

