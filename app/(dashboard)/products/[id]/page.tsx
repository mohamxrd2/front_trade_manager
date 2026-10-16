'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
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
import { updateArticle, deleteArticle, addStock } from '@/lib/services/articles'
import { createVariation, getVariations, deleteVariation, type Variation } from '@/lib/services/variations'
import { invalidateArticles, invalidateUserStats } from '@/lib/hooks/useCache'
import { useCurrency } from '@/lib/utils/currency'
import { useSettings } from '@/contexts/SettingsContext'
import { getTransactions, type Transaction } from '@/lib/services/transactions'
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

dayjs.locale('fr')

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const TYPE_OPTIONS = [
  { value: 'simple', label: 'Simple' },
  { value: 'variable', label: 'À variations' },
]

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
 * - Le réapprovisionnement (addStock) agit uniquement au niveau de
 *   l'article, jamais d'une variation précise (aucun endpoint dédié) : pas
 *   de sélecteur de variation dans le bloc "Réapprovisionner".
 * - L'historique de réapprovisionnement n'enregistre pas les variations
 *   concernées (aucune colonne en base) : on affiche la note libre saisie
 *   lors de l'ajout, le cas échéant, à la place des tailles fictives de la
 *   maquette.
 * - "Vendus (30 j)" / "CA généré (30 j)" sont calculés côté client à partir
 *   de GET /api/transactions (pas de filtre serveur par article ni par
 *   date) : aucun nouvel endpoint n'a été inventé.
 */
export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const { currency } = useCurrency()
  const { settings } = useSettings()

  const { article, error, isLoading, mutate: mutateArticle } = useArticle(productId)

  const [variations, setVariations] = React.useState<Variation[]>([])
  const [loadingVariations, setLoadingVariations] = React.useState(false)
  const [addVariationOpen, setAddVariationOpen] = React.useState(false)
  const [variationForm, setVariationForm] = React.useState({ name: '', quantity: '' })
  const [submittingVariation, setSubmittingVariation] = React.useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const [editingVariation, setEditingVariation] = React.useState<Variation | null>(null)
  const [editVariationDialogOpen, setEditVariationDialogOpen] = React.useState(false)
  const [deleteVariationDialogOpen, setDeleteVariationDialogOpen] = React.useState(false)
  const [variationToDelete, setVariationToDelete] = React.useState<Variation | null>(null)

  const [stockHistoryRefreshKey, setStockHistoryRefreshKey] = React.useState(0)
  const [restockQty, setRestockQty] = React.useState(10)
  const [restocking, setRestocking] = React.useState(false)
  const [mobileEditOpen, setMobileEditOpen] = React.useState(false)
  const [mobileRestockOpen, setMobileRestockOpen] = React.useState(false)

  const [name, setName] = React.useState('')
  const [salePrice, setSalePrice] = React.useState('')
  const [savingInfo, setSavingInfo] = React.useState(false)

  const [transactions, setTransactions] = React.useState<Transaction[]>([])

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
      toast.error('Erreur lors du chargement des variations')
    } finally {
      setLoadingVariations(false)
    }
  }, [productId])

  React.useEffect(() => {
    if (productId && article?.type === 'variable') {
      fetchVariations()
    }
  }, [productId, article?.type, fetchVariations])

  const totalVariationsQuantity = variations.reduce((sum, v) => sum + v.quantity, 0)
  const availableQuantityForVariations = (article?.quantity || 0) - totalVariationsQuantity

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

  const handleSaveInfo = async () => {
    if (!article) return
    const priceNum = parseFloat(salePrice)
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Le prix doit être supérieur ou égal à 0')
      return
    }
    setSavingInfo(true)
    try {
      await updateArticle(article.id, { name: name.trim(), sale_price: priceNum, quantity: article.quantity })
      toast.success('Article enregistré')
      await mutateArticle()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
    } catch (err: unknown) {
      toast.error((err as Error).message || "Échec de l'enregistrement")
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
      toast.success('Article supprimé')
      router.push('/products')
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erreur lors de la suppression')
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
      toast.success(`${restockQty} pièce(s) ajoutée(s) au stock`)
      setRestockQty(10)
      setStockHistoryRefreshKey((k) => k + 1)
      await mutateArticle()
      await Promise.all([invalidateArticles(), invalidateUserStats()])
    } catch (err: unknown) {
      toast.error((err as Error).message || "Échec de l'ajout de stock")
    } finally {
      setRestocking(false)
    }
  }

  const handleAddVariationSubmit = async () => {
    if (!variationForm.name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    const quantityNum = parseInt(variationForm.quantity, 10)
    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast.error('La quantité doit être positive')
      return
    }
    if (!article) return
    if (quantityNum > availableQuantityForVariations) {
      toast.error(`Quantité disponible : ${availableQuantityForVariations}`)
      return
    }
    setSubmittingVariation(true)
    try {
      await createVariation({ article_id: String(article.id), name: variationForm.name, quantity: quantityNum, image: null })
      toast.success('Variation ajoutée')
      setVariationForm({ name: '', quantity: '' })
      setAddVariationOpen(false)
      await mutateArticle()
      await fetchVariations()
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erreur lors de la création')
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
    toast.success('Variation modifiée')
  }

  const handleDeleteVariation = async () => {
    if (!variationToDelete) return
    try {
      await deleteVariation(variationToDelete.id)
      setVariations(variations.filter((v) => v.id !== variationToDelete.id))
      await mutateArticle()
      await fetchVariations()
      toast.success('Variation supprimée')
      setDeleteVariationDialogOpen(false)
      setVariationToDelete(null)
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erreur lors de la suppression')
    }
  }

  if (error) {
    const isAuthError = error.message.includes('Non authentifié')
    if (isAuthError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <AlertCircle className="h-12 w-12 text-subtle" />
          <p className="text-lg font-medium">Redirection vers la page de connexion...</p>
        </div>
      )
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erreur de chargement</AlertTitle>
        <AlertDescription>{error.message || "Impossible de charger l'article."}</AlertDescription>
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
          [Photo de l&apos;article]
          <Link
            href="/products"
            aria-label="Retour au stock"
            className="absolute left-5 top-[52px] flex size-11 items-center justify-center rounded-full bg-surface text-ink"
          >
            <ArrowLeft className="size-[22px]" />
          </Link>
          <button
            type="button"
            aria-label="Modifier l'article"
            onClick={() => setMobileEditOpen(true)}
            className="absolute right-5 top-[52px] flex size-11 items-center justify-center rounded-full bg-surface text-ink"
          >
            <Pencil className="size-5" strokeWidth={1.9} />
          </button>
        </div>

        <div className="-mt-6 flex flex-col gap-5 rounded-t-3xl bg-canvas p-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-500">
              {article.type === 'simple' ? 'Article simple' : 'Article à variations'}
            </span>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{article.name}</h1>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-ink">{formatAmount(article.sale_price)}</span>
              <span className="text-sm font-semibold text-subtle">{currency} / pièce</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1 rounded-tile border border-line bg-surface p-3">
              <span className="text-xs text-subtle">En stock</span>
              <span className="text-lg font-bold text-ink">{article.remaining_quantity}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-tile border border-line bg-surface p-3">
              <span className="text-xs text-subtle">Vendus (30 j)</span>
              <span className="text-lg font-bold text-ink">{last30Days.unitsSold}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-tile border border-line bg-surface p-3">
              <span className="text-xs text-subtle">Seuil</span>
              <span className="text-lg font-bold text-ink">{lowStockThreshold}%</span>
            </div>
          </div>

          {article.type === 'variable' ? (
            <div className="flex flex-col gap-2.5">
              <h2 className="text-lg font-bold text-ink">Variations</h2>
              {loadingVariations ? (
                <p className="text-sm text-subtle">Chargement…</p>
              ) : variations.length === 0 ? (
                <p className="text-sm text-subtle">Aucune variation pour cet article</p>
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
                      <span className="flex-1 text-sm font-semibold text-ink">{variation.name}</span>
                      {variation.low_stock ? (
                        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-bold text-warning">
                          Faible
                        </span>
                      ) : null}
                      <span className="text-sm font-bold text-ink">{variation.remaining_quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5">
            <h2 className="text-lg font-bold text-ink">Réapprovisionnements</h2>
            <StockHistoryList articleId={productId} refreshKey={stockHistoryRefreshKey} showUser={false} />
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2.5 border-t border-line bg-surface p-5 pb-7 lg:hidden">
        <Button variant="secondary" onClick={() => setMobileRestockOpen(true)}>
          Réapprovisionner
        </Button>
        <Button variant="primary" asChild>
          <Link href={sellHref}>Vendre</Link>
        </Button>
      </div>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
      {/* --- En-tête --- */}
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-col gap-1.5">
          <nav aria-label="Fil d'Ariane" className="flex gap-2 text-[13px] text-subtle">
            <Link href="/products" className="font-semibold">
              Stock
            </Link>
            <span aria-hidden>/</span>
            <span>{article.name}</span>
          </nav>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{article.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <Button
              variant="danger"
              className="border border-danger-border bg-surface"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Supprimer
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible et supprimera aussi ses variations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteArticle} disabled={deleting}>
                  {deleting ? 'Suppression…' : 'Supprimer'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="glass" asChild>
            <Link href={sellHref}>Vendre</Link>
          </Button>
          <Button variant="primary" onClick={handleSaveInfo} disabled={savingInfo}>
            {savingInfo ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* --- Panneau article (photo + champs éditables) --- */}
        <Card className="flex flex-[1_1_360px] flex-col gap-4 rounded-panel">
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-tile bg-gradient-to-br from-brand-100 to-brand-200 text-[13px] font-semibold text-brand-700">
            <ImageIcon className="size-10" strokeWidth={1.5} />
            [Photo de l&apos;article]
            <button
              type="button"
              onClick={() => toast('Téléversement de photo bientôt disponible')}
              className="flex min-h-10 items-center rounded-full bg-surface px-3.5 text-[13px] font-bold text-brand-700"
            >
              Changer l&apos;image
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="article-name" className="text-[13px] font-semibold text-ink">
              Nom
            </Label>
            <Input id="article-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="article-price" className="text-[13px] font-semibold text-ink">
                Prix de vente ({currency})
              </Label>
              <Input
                id="article-price"
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="h-12 rounded-field"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] font-semibold text-ink">Seuil d&apos;alerte</Label>
              <span className="flex h-12 items-center rounded-field border border-line-strong bg-surface-soft px-4 text-sm font-semibold text-ink-2">
                {lowStockThreshold}% des ventes
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-ink">Type d&apos;article</span>
            <SegmentedControl
              options={TYPE_OPTIONS}
              value={article.type}
              onChange={() => toast.error("Le type d'un article ne peut pas être modifié après sa création")}
            />
          </div>
        </Card>

        <div className="flex flex-[2_1_480px] flex-col gap-5">
          {/* --- KPI --- */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 rounded-card bg-hero p-[18px] text-white">
              <span className="text-[13px] text-navy-text">En stock</span>
              <span className="text-2xl font-bold tracking-[-0.02em]">{article.remaining_quantity} pièces</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card">
              <span className="text-[13px] text-subtle">Vendus (30 j)</span>
              <span className="text-2xl font-bold tracking-[-0.02em] text-ink">{last30Days.unitsSold}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-card bg-surface p-[18px] shadow-card">
              <span className="text-[13px] text-subtle">CA généré (30 j)</span>
              <span className="text-2xl font-bold tracking-[-0.02em] text-success">
                {formatAmount(last30Days.revenue)} F
              </span>
            </div>
          </div>

          {/* --- Variations --- */}
          {article.type === 'variable' ? (
            <Card className="flex flex-col gap-3 rounded-panel">
              <CardHeader>
                <CardTitle>Variations</CardTitle>
                <Button variant="secondary" onClick={() => setAddVariationOpen(true)}>
                  <Plus className="size-4" />
                  Ajouter une variation
                </Button>
              </CardHeader>
              {loadingVariations ? (
                <div className="py-8 text-center text-sm text-subtle">Chargement…</div>
              ) : variations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-subtle">
                  <Layers className="size-10" strokeWidth={1.5} />
                  Aucune variation pour cet article
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                        <th className="px-2 py-2">Variation</th>
                        <th className="px-2 py-2">Quantité</th>
                        <th className="px-2 py-2">Statut</th>
                        <th className="px-2 py-2 text-right">Action</th>
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
                          <td className="px-2 py-2.5 font-bold text-ink">{variation.remaining_quantity}</td>
                          <td className="px-2 py-2.5">
                            <StatusBadge status={variation.low_stock ? 'stock-faible' : 'disponible'} />
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <span className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVariation(variation)
                                  setEditVariationDialogOpen(true)
                                }}
                                className="inline-flex min-h-9 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-ink"
                              >
                                <Pencil className="mr-1.5 size-3.5" />
                                Modifier
                              </button>
                              <button
                                type="button"
                                aria-label="Supprimer la variation"
                                onClick={() => {
                                  setVariationToDelete(variation)
                                  setDeleteVariationDialogOpen(true)
                                }}
                                className="inline-flex size-9 items-center justify-center rounded-full border border-danger-border text-danger-strong"
                              >
                                <X className="size-3.5" />
                              </button>
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
            {/* --- Réapprovisionner (niveau article uniquement, voir note en tête de fichier) --- */}
            <Card className="glass-panel flex flex-[1_1_300px] flex-col gap-3">
              <CardTitle>Réapprovisionner</CardTitle>
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-[13px] font-semibold text-ink">Quantité ajoutée</span>
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Diminuer"
                    onClick={() => setRestockQty((q) => Math.max(1, q - 1))}
                    className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Quantité à réapprovisionner"
                    value={restockQty}
                    onChange={(e) => {
                      const next = parseInt(e.target.value, 10)
                      setRestockQty(Number.isNaN(next) || next < 1 ? 1 : next)
                    }}
                    className="w-14 rounded-lg border border-line-strong bg-surface text-center text-lg font-bold text-ink outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    aria-label="Augmenter"
                    onClick={() => setRestockQty((q) => q + 1)}
                    className="flex size-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white"
                  >
                    <Plus className="size-4" />
                  </button>
                </span>
              </div>
              <Button variant="black" onClick={handleRestock} disabled={restocking}>
                {restocking ? 'Ajout…' : `Ajouter ${restockQty} pièce(s) au stock`}
              </Button>
            </Card>

            {/* --- Historique --- */}
            <Card className="flex flex-[1_1_300px] flex-col gap-1.5">
              <CardTitle>Historique</CardTitle>
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
            <DialogTitle>Modifier l&apos;article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mobile-article-name">Nom</Label>
              <Input id="mobile-article-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-article-price">Prix de vente ({currency})</Label>
              <Input
                id="mobile-article-price"
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMobileEditOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                disabled={savingInfo}
                onClick={async () => {
                  await handleSaveInfo()
                  setMobileEditOpen(false)
                }}
              >
                {savingInfo ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Modale mobile : réapprovisionner --- */}
      <Dialog open={mobileRestockOpen} onOpenChange={setMobileRestockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réapprovisionner</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2.5">
            <span className="text-[13px] font-semibold text-ink">Quantité ajoutée</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Diminuer"
                onClick={() => setRestockQty((q) => Math.max(1, q - 1))}
                className="flex size-10 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Quantité à réapprovisionner"
                value={restockQty}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10)
                  setRestockQty(Number.isNaN(next) || next < 1 ? 1 : next)
                }}
                className="w-14 rounded-lg border border-line-strong bg-surface text-center text-lg font-bold text-ink outline-none focus:border-brand-500"
              />
              <button
                type="button"
                aria-label="Augmenter"
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
            {restocking ? 'Ajout…' : `Ajouter ${restockQty} pièce(s) au stock`}
          </Button>
        </DialogContent>
      </Dialog>

      {/* --- Modale : ajouter une variation --- */}
      <Dialog open={addVariationOpen} onOpenChange={setAddVariationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une variation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="variation-name">Nom de la variation</Label>
              <Input
                id="variation-name"
                placeholder="Ex: Taille M"
                value={variationForm.name}
                onChange={(e) => setVariationForm({ ...variationForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variation-quantity">Quantité</Label>
              <Input
                id="variation-quantity"
                type="number"
                min="1"
                max={availableQuantityForVariations}
                value={variationForm.quantity}
                onChange={(e) => setVariationForm({ ...variationForm, quantity: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Quantité disponible : {availableQuantityForVariations}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAddVariationOpen(false)
                  setVariationForm({ name: '', quantity: '' })
                }}
              >
                Annuler
              </Button>
              <Button variant="primary" onClick={handleAddVariationSubmit} disabled={submittingVariation}>
                {submittingVariation ? 'Ajout…' : 'Ajouter'}
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

      <AlertDialog open={deleteVariationDialogOpen} onOpenChange={setDeleteVariationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette variation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {variationToDelete?.name} sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVariation}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
