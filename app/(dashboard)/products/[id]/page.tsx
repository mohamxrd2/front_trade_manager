'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  Layers,
  Minus,
  Pencil,
  Plus,
  X,
} from 'lucide-react'

import { useArticle } from '@/lib/hooks/useArticles'
import { usePermissions } from '@/hooks/usePermissions'
import { updateArticle, deleteArticle, addStock } from '@/lib/services/articles'
import {
  createVariation,
  getVariations,
  deleteVariation,
  VariationHasStockError,
  type Variation,
} from '@/lib/services/variations'
import { invalidateArticles, invalidateUserStats } from '@/lib/hooks/useCache'
import { useCurrency } from '@/lib/utils/currency'
import { useSettings } from '@/contexts/SettingsContext'
import { getTransactions, type Transaction } from '@/lib/services/transactions'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EditVariationDialog } from '@/components/products/edit-variation-dialog'
import { StockHistoryList } from '@/components/products/stock-history-list'
import { Button, Card, CardHeader, CardTitle, StatusBadge, SegmentedControl } from '@/components/waelly'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function buildTypeOptions(t: ReturnType<typeof useTranslation>['t']) {
  return [
    { value: 'simple', label: t('products.typeSimple') },
    { value: 'variable', label: t('products.typeVariableOption') },
  ]
}

/**
 * Détail d'un article — reprend design/maquettes/ordinateur/Web-Article.dc.html
 * (≥ 1024px) et design/maquettes/mobile/Article.dc.html (< 768px).
 *
 * Écarts assumés (données/fonctionnalités réellement indisponibles, aucune
 * invention) :
 * - "Seuil d'alerte" n'est pas un champ par article : c'est un réglage
 *   global par utilisateur (% de ventes, Paramètres), affiché ici en lecture
 *   seule — la maquette montre une unité fixe ("5 pièces"), qui n'existe pas
 *   côté API.
 * - Le type (simple/variable) n'est pas modifiable après création (le
 *   backend renvoie une 400 si on tente de le changer) : le SegmentedControl
 *   est affiché mais son activation signale juste pourquoi ce n'est pas
 *   possible, il ne soumet rien.
 * - Pas de téléversement d'image d'article dans l'API actuelle : le bloc
 *   photo reste un espace réservé statique.
 * - "Vendus (30 j)" / "CA généré (30 j)" sont calculés côté client à partir
 *   de GET /api/transactions (pas de filtre serveur par article ni par
 *   date) : aucun nouvel endpoint n'a été inventé.
 * - Un article variable n'a ni quantité ni prix propres : quantity/sale_price
 *   ne sont JAMAIS envoyés sur PUT /api/articles/{id} pour ce type (seuls
 *   name/image le sont) — le total et la plage de prix affichés viennent
 *   entièrement des variations.
 */
export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const { currency } = useCurrency()
  const { settings } = useSettings()
  const { t, language } = useTranslation()
  // Caissier (stock.view seul) : consulte l'article, sans le modifier ni le
  // réapprovisionner — le serveur refuserait (403).
  const { can } = usePermissions()
  const canEditStock = can('stock.edit')
  const canRestock = can('stock.restock')
  const canSell = can('sales.create')
  const typeOptions = React.useMemo(() => buildTypeOptions(t), [t])

  const { article, error, isLoading, mutate: mutateArticle } = useArticle(productId)

  const [variations, setVariations] = React.useState<Variation[]>([])
  const [loadingVariations, setLoadingVariations] = React.useState(false)
  const [addVariationOpen, setAddVariationOpen] = React.useState(false)
  const [variationForm, setVariationForm] = React.useState({ name: '', quantity: '', price: '' })
  const [submittingVariation, setSubmittingVariation] = React.useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const [editingVariation, setEditingVariation] = React.useState<Variation | null>(null)
  const [editVariationDialogOpen, setEditVariationDialogOpen] = React.useState(false)
  const [deleteVariationDialogOpen, setDeleteVariationDialogOpen] = React.useState(false)
  const [variationToDelete, setVariationToDelete] = React.useState<Variation | null>(null)
  const [variationStockWarning, setVariationStockWarning] = React.useState<{ remaining: number; value: number } | null>(null)
  const [deletingVariation, setDeletingVariation] = React.useState(false)

  const [restockingVariation, setRestockingVariation] = React.useState<Variation | null>(null)
  const [variationRestockQty, setVariationRestockQty] = React.useState(10)
  const [restockingVariationBusy, setRestockingVariationBusy] = React.useState(false)

  const [stockHistoryRefreshKey, setStockHistoryRefreshKey] = React.useState(0)
  const [restockQty, setRestockQty] = React.useState(10)
  const [restocking, setRestocking] = React.useState(false)
  const [mobileEditOpen, setMobileEditOpen] = React.useState(false)
  const [mobileRestockOpen, setMobileRestockOpen] = React.useState(false)

  const [name, setName] = React.useState('')
  const [salePrice, setSalePrice] = React.useState('')
  const [savingInfo, setSavingInfo] = React.useState(false)

  const [transactions, setTransactions] = React.useState<Transaction[]>([])

  const isVariable = article?.type === 'variable'

  // Ne se resynchronise que sur un changement d'article réel (navigation
  // vers un autre id), pas sur chaque revalidation SWR du même article —
  // sinon une frappe en cours dans les champs serait écrasée en arrière-plan.
  React.useEffect(() => {
    if (article) {
      setName(article.name)
      setSalePrice(String(article.sale_price))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id])

  React.useEffect(() => {
    let cancelled = false
    getTransactions()
      .then((data) => {
        if (!cancelled) setTransactions(data)
      })
      .catch(() => {
        // Les KPI 30 j restent à 0 si la requête échoue — pas de blocage de page.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fetchVariations = React.useCallback(async () => {
    setLoadingVariations(true)
    try {
      setVariations(await getVariations(productId))
    } catch {
      toast.error(t('products.detail.variationsLoadError'))
    } finally {
      setLoadingVariations(false)
    }
  }, [productId, t])

  React.useEffect(() => {
    if (productId && article?.type === 'variable') {
      fetchVariations()
    }
  }, [productId, article?.type, fetchVariations])

  const last30Days = React.useMemo(() => {
    const cutoff = dayjs().subtract(30, 'day')
    const relevant = transactions.filter(
      (t) => t.type === 'sale' && t.article_id === productId && dayjs(t.date).isAfter(cutoff)
    )
    return {
      unitsSold: relevant.reduce((sum, t) => sum + (t.quantity ?? 0), 0),
      revenue: relevant.reduce((sum, t) => sum + (t.amount ?? 0), 0),
    }
  }, [transactions, productId])

  const lowStockThreshold = settings?.low_stock_threshold ?? 80

  const priceLabel = React.useMemo(() => {
    if (!article) return ''
    if (!isVariable) return `${formatAmount(article.sale_price, language)} ${currency}`
    const min = article.sale_price
    const max = article.price_max ?? article.sale_price
    return min === max
      ? `${formatAmount(min, language)} ${currency}`
      : `${formatAmount(min, language)} – ${formatAmount(max, language)} ${currency}`
  }, [article, isVariable, currency, language])

  const handleSaveInfo = async () => {
    if (!article) return
    if (!name.trim()) {
      toast.error(t('products.detail.errorNameRequired'))
      return
    }

    setSavingInfo(true)
    try {
      if (article.type === 'simple') {
        const priceNum = parseFloat(salePrice)
        if (isNaN(priceNum) || priceNum < 0) {
          toast.error(t('products.detail.errorPriceMin'))
          setSavingInfo(false)
          return
        }
        await updateArticle(article.id, { name: name.trim(), sale_price: priceNum, quantity: article.quantity })
      } else {
        // Un article variable n'a pas de prix/quantité propres : jamais
        // envoyés ici, ils resteraient ignorés côté backend de toute façon.
        await updateArticle(article.id, { name: name.trim() })
      }
      toast.success(t('products.detail.toastArticleSaved'))
      await mutateArticle()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
    } catch (err: unknown) {
      toast.error((err as Error).message || t('products.detail.errorSaveFailed'))
    } finally {
      setSavingInfo(false)
    }
  }

  const handleDeleteArticle = async () => {
    if (!article) return
    setDeleting(true)
    try {
      await deleteArticle(productId)
      await Promise.all([invalidateArticles(), invalidateUserStats()])
      toast.success(t('products.detail.toastArticleDeleted'))
      router.push('/products')
    } catch (err: unknown) {
      toast.error((err as Error).message || t('products.detail.errorDeleteFailed'))
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleRestock = async () => {
    if (!article) return
    setRestocking(true)
    try {
      await addStock(article.id, restockQty)
      toast.success(t('products.detail.toastStockAdded', { count: restockQty }))
      setRestockQty(10)
      setStockHistoryRefreshKey((k) => k + 1)
      await mutateArticle()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
    } catch (err: unknown) {
      toast.error((err as Error).message || t('products.detail.errorStockAddFailed'))
    } finally {
      setRestocking(false)
    }
  }

  const handleRestockVariation = async () => {
    if (!article || !restockingVariation) return
    setRestockingVariationBusy(true)
    try {
      await addStock(article.id, variationRestockQty, restockingVariation.id)
      toast.success(t('products.detail.toastStockAddedTo', { count: variationRestockQty, name: restockingVariation.name }))
      setStockHistoryRefreshKey((k) => k + 1)
      setRestockingVariation(null)
      setVariationRestockQty(10)
      await mutateArticle()
      await fetchVariations()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
    } catch (err: unknown) {
      toast.error((err as Error).message || t('products.detail.errorStockAddFailed'))
    } finally {
      setRestockingVariationBusy(false)
    }
  }

  const handleAddVariationSubmit = async () => {
    if (!variationForm.name.trim()) {
      toast.error(t('products.detail.errorNameRequired'))
      return
    }
    const quantityNum = parseInt(variationForm.quantity, 10)
    if (isNaN(quantityNum) || quantityNum < 0) {
      toast.error(t('products.detail.errorQuantityPositive'))
      return
    }
    const priceNum = parseFloat(variationForm.price)
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(t('products.detail.errorPricePositive'))
      return
    }
    if (!article) return
    setSubmittingVariation(true)
    try {
      await createVariation({
        article_id: String(article.id),
        name: variationForm.name,
        quantity: quantityNum,
        price: priceNum,
        image: null,
      })
      toast.success(t('products.detail.toastVariationAdded'))
      setVariationForm({ name: '', quantity: '', price: '' })
      setAddVariationOpen(false)
      await mutateArticle()
      await fetchVariations()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
    } catch (err: unknown) {
      toast.error((err as Error).message || t('products.detail.errorCreateFailed'))
    } finally {
      setSubmittingVariation(false)
    }
  }

  const handleEditVariationSuccess = async (updatedVariation: Variation) => {
    setVariations(variations.map((v) => (v.id === updatedVariation.id ? updatedVariation : v)))
    setEditVariationDialogOpen(false)
    setEditingVariation(null)
    await mutateArticle()
    await fetchVariations()
    toast.success(t('products.detail.toastVariationModified'))
  }

  const openDeleteVariationDialog = (variation: Variation) => {
    setVariationToDelete(variation)
    setVariationStockWarning(null)
    setDeleteVariationDialogOpen(true)
  }

  const handleDeleteVariation = async (confirm = false) => {
    if (!variationToDelete) return
    setDeletingVariation(true)
    try {
      await deleteVariation(variationToDelete.id, confirm ? { confirm: true } : undefined)
      setVariations(variations.filter((v) => v.id !== variationToDelete.id))
      await mutateArticle()
      await fetchVariations()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
      toast.success(t('products.detail.toastVariationArchived'))
      setDeleteVariationDialogOpen(false)
      setVariationToDelete(null)
      setVariationStockWarning(null)
    } catch (err: unknown) {
      if (err instanceof VariationHasStockError) {
        setVariationStockWarning({
          remaining: err.remainingQuantity,
          value: err.remainingQuantity * variationToDelete.price,
        })
      } else {
        toast.error((err as Error).message || t('products.detail.errorDeleteFailed'))
      }
    } finally {
      setDeletingVariation(false)
    }
  }

  if (error) {
    const isAuthError = error.message.includes('Non authentifié') // i18n:allow — sentinelle interne (lib/services/articles.ts), jamais affichée
    if (isAuthError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-subtle" />
          <p className="text-lg font-medium">{t('products.authRedirect')}</p>
        </div>
      )
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('products.loadError')}</AlertTitle>
        <AlertDescription>{error.message || t('products.detail.loadErrorDescription')}</AlertDescription>
      </Alert>
    )
  }

  if (isLoading || !article) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-8 w-60 animate-pulse rounded bg-surface-soft" />
        <div className="flex flex-wrap gap-5">
          <div className="h-[420px] flex-[1_1_360px] animate-pulse rounded-panel bg-surface-soft" />
          <div className="h-[420px] flex-[2_1_480px] animate-pulse rounded-panel bg-surface-soft" />
        </div>
      </div>
    )
  }

  const sellHref = `/wallet/new?type=sale&article=${article.id}`

  return (
    <div className="flex flex-col gap-5">
      {/* --- Mobile (< 1024px) --- */}
      <div className="-mx-4 -mt-5 flex flex-col pb-28 lg:hidden">
        <div className="relative flex h-[290px] flex-col items-center justify-center gap-2 bg-brand-100 text-[13px] font-semibold text-brand-700">
          <ImageIcon className="size-10" strokeWidth={1.5} />
          {t('products.detail.photoPlaceholder')}
          <Link
            href="/products"
            aria-label={t('products.detail.backToStock')}
            className="absolute left-5 top-[52px] flex size-11 items-center justify-center rounded-full bg-surface text-ink"
          >
            <ArrowLeft className="size-[22px]" />
          </Link>
          {canEditStock ? (
            <button
              type="button"
              aria-label={t('products.detail.editArticle')}
              onClick={() => setMobileEditOpen(true)}
              className="absolute right-5 top-[52px] flex size-11 items-center justify-center rounded-full bg-surface text-ink"
            >
              <Pencil className="size-5" strokeWidth={1.9} />
            </button>
          ) : null}
        </div>

        <div className="-mt-6 flex flex-col gap-5 rounded-t-3xl bg-canvas p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-500">
              {article.type === 'simple' ? t('products.detail.simpleArticleBadge') : t('products.detail.variableArticleBadge')}
            </span>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{article.name}</h1>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-ink">{priceLabel}</span>
              {!isVariable ? <span className="text-sm font-semibold text-subtle">{t('products.detail.perPiece')}</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1 rounded-tile border border-line bg-surface p-3">
              <span className="text-xs text-subtle">{t('products.detail.inStock')}</span>
              <span className="text-lg font-bold text-ink">{article.remaining_quantity}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-tile border border-line bg-surface p-3">
              <span className="text-xs text-subtle">{t('products.detail.soldLast30Days')}</span>
              <span className="text-lg font-bold text-ink">{last30Days.unitsSold}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-tile border border-line bg-surface p-3">
              <span className="text-xs text-subtle">{t('products.detail.threshold')}</span>
              <span className="text-lg font-bold text-ink">{lowStockThreshold}%</span>
            </div>
          </div>

          {article.type === 'variable' ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">{t('products.detail.variationsTitle')}</h2>
                {canEditStock ? (
                  <button
                    type="button"
                    onClick={() => setAddVariationOpen(true)}
                    className="text-[13px] font-bold text-brand-700"
                  >
                    {t('products.detail.addShort')}
                  </button>
                ) : null}
              </div>
              {loadingVariations ? (
                <p className="text-sm text-subtle">{t('products.detail.loading')}</p>
              ) : variations.length === 0 ? (
                <p className="text-sm text-subtle">{t('products.detail.noVariationForArticle')}</p>
              ) : (
                <div className="flex flex-col rounded-tile border border-line bg-surface">
                  {variations.map((variation, i) => (
                    <div
                      key={variation.id}
                      className={`flex items-center gap-3 p-3.5 ${i > 0 ? 'border-t border-divider' : ''}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-soft text-[13px] font-bold text-ink">
                        {variation.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-semibold text-ink">{variation.name}</span>
                        <span className="text-xs text-subtle">{formatAmount(variation.price, language)} {currency}</span>
                      </span>
                      {variation.low_stock ? (
                        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning">
                          {t('products.detail.lowBadge')}
                        </span>
                      ) : null}
                      <span className="text-sm font-bold text-ink">{variation.remaining_quantity}</span>
                      {canRestock ? (
                        <button
                          type="button"
                          aria-label={t('products.detail.restockVariationAria', { name: variation.name })}
                          onClick={() => {
                            setRestockingVariation(variation)
                            setVariationRestockQty(10)
                          }}
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <h2 className="text-lg font-bold text-ink">{t('products.detail.restockHistoryMobile')}</h2>
            <StockHistoryList articleId={productId} refreshKey={stockHistoryRefreshKey} showUser={false} />
          </div>
        </div>
      </div>

      {(isVariable ? canEditStock : canRestock) || canSell ? (
        <div className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col gap-2.5 border-t border-line bg-surface p-5 pb-7 lg:hidden">
          {(isVariable ? canEditStock : canRestock) ? (
            <Button
              variant="secondary"
              onClick={() => (isVariable ? setAddVariationOpen(true) : setMobileRestockOpen(true))}
            >
              {isVariable ? t('products.detail.manageVariations') : t('products.detail.restock')}
            </Button>
          ) : null}
          {canSell ? (
            <Button variant="primary" asChild>
              <Link href={sellHref}>{t('products.detail.sell')}</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
      {/* --- En-tête --- */}
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-col gap-1.5">
          <nav aria-label={t('products.breadcrumbAria')} className="flex gap-2 text-[13px] text-subtle">
            <Link href="/products" className="font-semibold">
              {t('products.stockBreadcrumb')}
            </Link>
            <span aria-hidden>/</span>
            <span>{article.name}</span>
          </nav>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{article.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canEditStock ? (
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <Button
                variant="danger"
                className="border border-danger-border bg-surface"
                onClick={() => setDeleteDialogOpen(true)}
              >
                {t('products.detail.deleteArticle')}
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('products.detail.deleteArticleTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('products.detail.deleteArticleDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>{t('products.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteArticle} disabled={deleting}>
                    {deleting ? t('products.detail.deleting') : t('products.detail.deleteArticle')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {canSell ? (
            <Button variant="glass" asChild>
              <Link href={sellHref}>{t('products.detail.sell')}</Link>
            </Button>
          ) : null}
          {canEditStock ? (
            <Button variant="primary" onClick={handleSaveInfo} disabled={savingInfo}>
              {savingInfo ? t('products.saving') : t('products.save')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* --- Panneau article (photo + champs éditables) --- */}
        <Card className="flex flex-[1_1_360px] flex-col gap-4 rounded-panel">
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-tile bg-gradient-to-br from-brand-100 to-brand-200 text-[13px] font-semibold text-brand-700">
            <ImageIcon className="size-10" strokeWidth={1.5} />
            {t('products.detail.photoPlaceholder')}
            <button
              type="button"
              onClick={() => toast(t('products.detail.photoUploadSoon'))}
              className="flex min-h-10 items-center rounded-full bg-surface px-3.5 text-[13px] font-bold text-brand-700"
            >
              {t('products.detail.changeImage')}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="article-name" className="text-[13px] font-semibold text-ink">
              {t('products.detail.nameLabel')}
            </Label>
            <Input id="article-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="article-price" className="text-[13px] font-semibold text-ink">
                {t('products.detail.salePriceLabel', { currency })}
              </Label>
              {article.type === 'simple' ? (
                <Input
                  id="article-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="h-12 rounded-field"
                />
              ) : (
                <span className="flex h-12 items-center rounded-field border border-line-strong bg-surface-soft px-4 text-sm font-semibold text-ink-2">
                  {priceLabel}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] font-semibold text-ink">{t('products.detail.alertThreshold')}</Label>
              <span className="flex h-12 items-center rounded-field border border-line-strong bg-surface-soft px-4 text-sm font-semibold text-ink-2">
                {t('products.detail.thresholdOfSales', { threshold: lowStockThreshold })}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink">{t('products.detail.articleType')}</span>
            <SegmentedControl
              options={typeOptions}
              value={article.type}
              onChange={() => toast.error(t('products.detail.typeChangeError'))}
            />
          </div>
        </Card>

        <div className="flex flex-[2_1_480px] flex-col gap-5">
          {/* --- KPI --- */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 rounded-card bg-hero p-[18px] text-white">
              <span className="text-[13px] text-navy-text">{t('products.detail.inStock')}</span>
              <span className="text-2xl font-bold tracking-[-0.02em]">{t('products.detail.piecesUnit', { count: article.remaining_quantity })}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card">
              <span className="text-[13px] text-subtle">{t('products.detail.soldLast30Days')}</span>
              <span className="text-2xl font-bold tracking-[-0.02em] text-ink">{last30Days.unitsSold}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card">
              <span className="text-[13px] text-subtle">{t('products.detail.revenueLast30Days')}</span>
              <span className="text-2xl font-bold tracking-[-0.02em] text-success">
                {formatAmount(last30Days.revenue, language)} F
              </span>
            </div>
          </div>

          {/* --- Variations --- */}
          {article.type === 'variable' ? (
            <Card className="flex flex-col gap-3 rounded-panel">
              <CardHeader>
                <CardTitle>{t('products.detail.variationsTitle')}</CardTitle>
                {canEditStock ? (
                  <Button variant="secondary" onClick={() => setAddVariationOpen(true)}>
                    <Plus className="size-4" />
                    {t('products.detail.addVariation')}
                  </Button>
                ) : null}
              </CardHeader>
              {loadingVariations ? (
                <div className="py-8 text-center text-sm text-subtle">{t('products.detail.loading')}</div>
              ) : variations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-subtle">
                  <Layers className="size-10" strokeWidth={1.5} />
                  {t('products.detail.noVariationForArticle')}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                        <th className="px-2 py-2">{t('products.colVariation')}</th>
                        <th className="px-2 py-2">{t('products.colPrice')}</th>
                        <th className="px-2 py-2">{t('products.colQuantity')}</th>
                        <th className="px-2 py-2">{t('products.colStatus')}</th>
                        <th className="px-2 py-2 text-right">{t('products.colAction')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variations.map((variation) => (
                        <tr key={variation.id} className="border-t border-divider">
                          <td className="px-2 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-tile bg-surface-soft text-[13px] font-bold text-ink">
                                {variation.name.slice(0, 2).toUpperCase()}
                              </span>
                              {variation.name}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 font-semibold text-ink">
                            {formatAmount(variation.price, language)} {currency}
                          </td>
                          <td className="px-2 py-2.5 font-bold text-ink">{variation.remaining_quantity}</td>
                          <td className="px-2 py-2.5">
                            <StatusBadge status={variation.low_stock ? 'stock-faible' : 'disponible'} />
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              {canRestock ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockingVariation(variation)
                                    setVariationRestockQty(10)
                                  }}
                                  className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-ink"
                                >
                                  <Plus className="mr-1.5 size-3.5" />
                                  {t('products.detail.restock')}
                                </button>
                              ) : null}
                              {canEditStock ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingVariation(variation)
                                      setEditVariationDialogOpen(true)
                                    }}
                                    className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-ink"
                                  >
                                    <Pencil className="mr-1.5 size-3.5" />
                                    {t('products.detail.modify')}
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={t('products.detail.archiveVariationAria')}
                                    onClick={() => openDeleteVariationDialog(variation)}
                                    className="inline-flex size-9 items-center justify-center rounded-full border border-danger-border text-danger-strong"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : null}

          <div className="flex flex-wrap items-start gap-5">
            {!isVariable && canRestock ? (
              <Card className="glass-panel flex flex-[1_1_300px] flex-col gap-3">
                <CardTitle>{t('products.detail.restock')}</CardTitle>
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[13px] font-semibold text-ink">{t('products.detail.quantityAdded')}</span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={t('products.decrease')}
                      onClick={() => setRestockQty((q) => Math.max(1, q - 1))}
                      className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
                    >
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      aria-label={t('products.detail.restockQuantityAria')}
                      value={restockQty}
                      onChange={(e) => {
                        const next = parseInt(e.target.value, 10)
                        setRestockQty(Number.isNaN(next) || next < 1 ? 1 : next)
                      }}
                      className="w-14 rounded-lg border border-line-strong bg-surface text-center text-lg font-bold text-ink outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      aria-label={t('products.increase')}
                      onClick={() => setRestockQty((q) => q + 1)}
                      className="flex size-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white"
                    >
                      <Plus className="size-4" />
                    </button>
                  </span>
                </div>
                <Button variant="black" onClick={handleRestock} disabled={restocking}>
                  {restocking ? t('products.detail.adding') : t('products.detail.addToStock', { count: restockQty })}
                </Button>
              </Card>
            ) : null}

            {/* --- Historique --- */}
            <Card className="flex flex-[1_1_300px] flex-col gap-1.5">
              <CardTitle>{t('products.detail.restockHistoryDesktop')}</CardTitle>
              <StockHistoryList articleId={productId} refreshKey={stockHistoryRefreshKey} />
            </Card>
          </div>
        </div>
      </div>
      </div>

      {/* --- Modale mobile : modifier l'article --- */}
      <Dialog open={mobileEditOpen} onOpenChange={setMobileEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.detail.editArticle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mobile-article-name">{t('products.detail.nameLabel')}</Label>
              <Input id="mobile-article-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {article.type === 'simple' ? (
              <div className="space-y-2">
                <Label htmlFor="mobile-article-price">{t('products.detail.salePriceLabel', { currency })}</Label>
                <Input
                  id="mobile-article-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('products.detail.priceComputedFromVariations', { price: priceLabel })}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMobileEditOpen(false)}>
                {t('products.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={savingInfo}
                onClick={async () => {
                  await handleSaveInfo()
                  setMobileEditOpen(false)
                }}
              >
                {savingInfo ? t('products.saving') : t('products.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Modale mobile : réapprovisionner (article simple) --- */}
      <Dialog open={mobileRestockOpen} onOpenChange={setMobileRestockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.detail.restock')}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[13px] font-semibold text-ink">{t('products.detail.quantityAdded')}</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t('products.decrease')}
                onClick={() => setRestockQty((q) => Math.max(1, q - 1))}
                className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label={t('products.detail.restockQuantityAria')}
                value={restockQty}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10)
                  setRestockQty(Number.isNaN(next) || next < 1 ? 1 : next)
                }}
                className="w-14 rounded-lg border border-line-strong bg-surface text-center text-lg font-bold text-ink outline-none focus:border-brand-500"
              />
              <button
                type="button"
                aria-label={t('products.increase')}
                onClick={() => setRestockQty((q) => q + 1)}
                className="flex size-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white"
              >
                <Plus className="size-4" />
              </button>
            </span>
          </div>
          <Button
            variant="black"
            disabled={restocking}
            onClick={async () => {
              await handleRestock()
              setMobileRestockOpen(false)
            }}
          >
            {restocking ? t('products.detail.adding') : t('products.detail.addToStock', { count: restockQty })}
          </Button>
        </DialogContent>
      </Dialog>

      {/* --- Modale : réapprovisionner une variation précise --- */}
      <Dialog
        open={restockingVariation !== null}
        onOpenChange={(open) => {
          if (!open) setRestockingVariation(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.detail.restockVariationAria', { name: restockingVariation?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[13px] font-semibold text-ink">{t('products.detail.quantityAdded')}</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={t('products.decrease')}
                onClick={() => setVariationRestockQty((q) => Math.max(1, q - 1))}
                className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label={t('products.detail.restockQuantityAria')}
                value={variationRestockQty}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10)
                  setVariationRestockQty(Number.isNaN(next) || next < 1 ? 1 : next)
                }}
                className="w-14 rounded-lg border border-line-strong bg-surface text-center text-lg font-bold text-ink outline-none focus:border-brand-500"
              />
              <button
                type="button"
                aria-label={t('products.increase')}
                onClick={() => setVariationRestockQty((q) => q + 1)}
                className="flex size-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white"
              >
                <Plus className="size-4" />
              </button>
            </span>
          </div>
          <Button variant="black" disabled={restockingVariationBusy} onClick={handleRestockVariation}>
            {restockingVariationBusy ? t('products.detail.adding') : t('products.detail.addPieces', { count: variationRestockQty })}
          </Button>
        </DialogContent>
      </Dialog>

      {/* --- Modale : ajouter une variation --- */}
      <Dialog open={addVariationOpen} onOpenChange={setAddVariationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('products.detail.addVariation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variation-name">{t('products.detail.variationNameLabel')}</Label>
              <Input
                id="variation-name"
                placeholder={t('products.detail.variationNamePlaceholder')}
                value={variationForm.name}
                onChange={(e) => setVariationForm({ ...variationForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variation-quantity">{t('products.detail.quantityLabel')}</Label>
              <Input
                id="variation-quantity"
                type="number"
                min="0"
                value={variationForm.quantity}
                onChange={(e) => setVariationForm({ ...variationForm, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variation-price">{t('products.detail.salePriceLabel', { currency })}</Label>
              <Input
                id="variation-price"
                type="number"
                min="0"
                step="0.01"
                value={variationForm.price}
                onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAddVariationOpen(false)
                  setVariationForm({ name: '', quantity: '', price: '' })
                }}
              >
                {t('products.cancel')}
              </Button>
              <Button variant="primary" onClick={handleAddVariationSubmit} disabled={submittingVariation}>
                {submittingVariation ? t('products.detail.adding') : t('products.detail.add')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editingVariation ? (
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
      ) : null}

      <AlertDialog
        open={deleteVariationDialogOpen}
        onOpenChange={(open) => {
          setDeleteVariationDialogOpen(open)
          if (!open) {
            setVariationToDelete(null)
            setVariationStockWarning(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {variationStockWarning ? t('products.detail.archiveStockTitle') : t('products.detail.archiveTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {variationStockWarning
                ? t('products.detail.archiveStockDescription', {
                    name: variationToDelete?.name ?? '',
                    remaining: variationStockWarning.remaining,
                    value: formatAmount(variationStockWarning.value, language),
                    currency,
                  })
                : t('products.detail.archiveDescription', { name: variationToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingVariation}>{t('products.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteVariation(!!variationStockWarning)} disabled={deletingVariation}>
              {deletingVariation ? '…' : variationStockWarning ? t('products.detail.confirmArchive') : t('products.detail.archive')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
