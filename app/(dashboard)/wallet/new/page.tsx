'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

import api from '@/lib/api'
import { getArticles, type Article, type Variation } from '@/lib/services/articles'
import { getClients, createInvoice, type Client } from '@/lib/services/invoices'
import { keys } from '@/lib/query-keys'
import { isSilentError } from '@/lib/utils/error-handler'
import { useCurrency } from '@/lib/utils/currency'
import { Button, Card, SegmentedControl } from '@/components/waelly'
import { VariationPicker } from '@/components/products'

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const THUMB_TINTS = [
  { bg: 'bg-brand-100', text: 'text-brand-700' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]

/**
 * Nouvelle opération — reprend design/maquettes/ordinateur/Web-Vente.dc.html
 * (≥ 1024px) et design/maquettes/mobile/Vente.dc.html (< 768px). Remplace
 * l'ancienne modale (components/wallet/add-transaction-dialog.tsx).
 *
 * Écarts assumés :
 * - Le champ "Date" de la dépense (maquette) n'existe pas : l'API ne permet
 *   pas de dater une transaction autrement qu'à "maintenant".
 * - "+ Nouveau client…" renvoie vers /clients (pas de création de client en
 *   ligne ici) — aucun formulaire inline de ce type n'existait déjà ailleurs.
 */
export default function NewTransactionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currency } = useCurrency()
  const queryClient = useQueryClient()

  // Invalide uniquement les clés concernées par une nouvelle transaction —
  // jamais un invalidateQueries() sans clé. `notification-updated` reste un
  // événement DOM (pas une query React Query) : le compteur de non-lues
  // partagé (hooks/useNotifications.ts) s'appuie volontairement sur son
  // propre polling + cet événement plutôt que sur le cache TanStack Query.
  const invalidateAfterTransaction = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: keys.products.all })
    queryClient.invalidateQueries({ queryKey: keys.userStats.all })
    queryClient.invalidateQueries({ queryKey: keys.wallet.all })
    queryClient.invalidateQueries({ queryKey: keys.analytics.all })
    queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
    window.dispatchEvent(new CustomEvent('notification-updated'))
  }, [queryClient])

  const initialMode = searchParams.get('type') === 'expense' ? 'expense' : 'sale'
  const [mode, setMode] = React.useState<'sale' | 'expense'>(initialMode)

  // --- Vente ---
  const [articles, setArticles] = React.useState<Article[]>([])
  const [loadingArticles, setLoadingArticles] = React.useState(false)
  const [articleSearch, setArticleSearch] = React.useState('')
  const [selectedArticleId, setSelectedArticleId] = React.useState<string | null>(null)
  const [selectedVariationId, setSelectedVariationId] = React.useState<string | null>(null)
  const [quantity, setQuantity] = React.useState(1)
  const [unitPrice, setUnitPrice] = React.useState('')
  const [generateInvoice, setGenerateInvoice] = React.useState(false)
  const [clientId, setClientId] = React.useState('')
  const [clients, setClients] = React.useState<Client[]>([])
  const [loadingClients, setLoadingClients] = React.useState(false)
  const [submittingSale, setSubmittingSale] = React.useState(false)

  // --- Dépense ---
  const [expenseName, setExpenseName] = React.useState('')
  const [expenseAmount, setExpenseAmount] = React.useState('')
  const [submittingExpense, setSubmittingExpense] = React.useState(false)

  React.useEffect(() => {
    setLoadingArticles(true)
    getArticles()
      .then(setArticles)
      .catch(() => toast.error('Erreur lors du chargement des articles'))
      .finally(() => setLoadingArticles(false))
  }, [])

  const clientsFetchedRef = React.useRef(false)
  React.useEffect(() => {
    if (!generateInvoice || clientsFetchedRef.current) return
    clientsFetchedRef.current = true
    setLoadingClients(true)
    getClients()
      .then(setClients)
      .catch(() => {
        clientsFetchedRef.current = false
        toast.error('Erreur lors du chargement des clients')
      })
      .finally(() => setLoadingClients(false))
  }, [generateInvoice])

  const filteredArticles = React.useMemo(
    () => articles.filter((a) => a.name.toLowerCase().includes(articleSearch.trim().toLowerCase())),
    [articles, articleSearch]
  )

  const selectedArticle = articles.find((a) => String(a.id) === selectedArticleId) ?? null
  const selectedVariation: Variation | null =
    selectedArticle?.variations?.find((v) => v.id === selectedVariationId) ?? null

  const availableQuantity = selectedVariation
    ? selectedVariation.remaining_quantity
    : (selectedArticle?.remaining_quantity ?? 0)

  const overStock = quantity > availableQuantity
  const unitPriceNum =
    unitPrice === '' ? (selectedVariation?.price ?? selectedArticle?.sale_price ?? 0) : parseFloat(unitPrice)
  const total = quantity * (isNaN(unitPriceNum) ? 0 : unitPriceNum)

  const pickArticle = (article: Article) => {
    setSelectedArticleId(String(article.id))
    const firstVariation = article.variations?.[0] ?? null
    setSelectedVariationId(firstVariation?.id ?? null)
    // Le prix par défaut d'une ligne variable est celui DE LA VARIATION
    // choisie, jamais le prix (min/max) de l'article.
    setUnitPrice(String(firstVariation ? firstVariation.price : article.sale_price))
    setQuantity(1)
  }

  const pickVariation = (variation: Variation) => {
    setSelectedVariationId(variation.id)
    setUnitPrice(String(variation.price))
    setQuantity(1)
  }

  // Présélection depuis /products/[id] ("Vendre" sur un article précis) :
  // ?article=<id> doit sélectionner cet article dès que la liste est chargée.
  const preselectArticleId = searchParams.get('article')
  React.useEffect(() => {
    if (!preselectArticleId || selectedArticleId) return
    const match = articles.find((a) => String(a.id) === preselectArticleId)
    if (match) pickArticle(match)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, preselectArticleId])

  const handleSaleSubmit = async () => {
    if (!selectedArticle) {
      toast.error('Sélectionnez un article')
      return
    }
    if (selectedArticle.variations?.length && !selectedVariation) {
      toast.error('Sélectionnez une variation')
      return
    }
    if (quantity > availableQuantity) {
      toast.error(`Quantité disponible : ${availableQuantity}`)
      return
    }
    if (generateInvoice && !clientId) {
      toast.error('Sélectionnez un client pour générer la facture')
      return
    }

    // Générée une seule fois par soumission (ce clic), conservée pour tous
    // les retries automatiques axios de CETTE tentative : permet au backend
    // de reconnaître un rejeu de la même soumission plutôt que de créer une
    // transaction en double. Ne pas régénérer ailleurs dans ce flux.
    const idempotencyKey = crypto.randomUUID()

    setSubmittingSale(true)
    try {
      const payload: {
        type: 'sale'
        article_id: string
        variable_id?: string | null
        quantity: number
        sale_price?: number
      } = {
        type: 'sale',
        article_id: String(selectedArticle.id),
        variable_id: selectedVariation?.id ?? null,
        quantity,
      }
      if (unitPriceNum !== selectedArticle.sale_price) {
        payload.sale_price = unitPriceNum
      }

      const response = await api.post<{ success: boolean; data?: { id: string } }>(
        '/api/transactions',
        payload,
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )

      if (!response.data.success) {
        toast.error('Échec de la vente')
        return
      }

      toast.success('Vente enregistrée')

      if (typeof window !== 'undefined') {
        const reloadFn = (window as { reloadWalletStats?: () => void }).reloadWalletStats
        reloadFn?.()
      }
      invalidateAfterTransaction()

      if (generateInvoice && clientId) {
        try {
          await createInvoice({
            client_id: clientId,
            items: [
              {
                article_id: String(selectedArticle.id),
                variation_id: selectedVariation?.id,
                quantity,
                unit_price: unitPriceNum,
              },
            ],
            due_date: dayjs().add(7, 'day').format('YYYY-MM-DD'),
            theme: 'modern',
          })
          toast.success('Facture générée')
        } catch {
          toast.error("La vente est enregistrée, mais la facture n'a pas pu être créée")
        }
      }

      router.push('/wallet')
    } catch (error: unknown) {
      if (isSilentError(error)) return
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      toast.error(axiosError.response?.data?.message || 'Échec de la vente')
    } finally {
      setSubmittingSale(false)
    }
  }

  const handleExpenseSubmit = async () => {
    if (!expenseName.trim() || expenseName.trim().length < 2) {
      toast.error('Le libellé est requis (2 caractères minimum)')
      return
    }
    const amountNum = parseFloat(expenseAmount)
    if (isNaN(amountNum) || amountNum < 0.01) {
      toast.error('Le montant doit être supérieur à 0')
      return
    }

    const idempotencyKey = crypto.randomUUID()
    setSubmittingExpense(true)
    try {
      const response = await api.post<{ success: boolean }>(
        '/api/transactions',
        { type: 'expense', name: expenseName.trim(), amount: amountNum },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      )
      if (!response.data.success) {
        toast.error('Échec de la dépense')
        return
      }
      toast.success('Dépense enregistrée')
      if (typeof window !== 'undefined') {
        const reloadFn = (window as { reloadWalletStats?: () => void }).reloadWalletStats
        reloadFn?.()
      }
      invalidateAfterTransaction()
      router.push('/wallet')
    } catch (error: unknown) {
      if (isSilentError(error)) return
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      toast.error(axiosError.response?.data?.message || 'Échec de la dépense')
    } finally {
      setSubmittingExpense(false)
    }
  }

  const modeOptions = [
    { value: 'sale', label: 'Vente' },
    { value: 'expense', label: 'Dépense' },
  ]

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      {/* --- En-tête --- */}
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-col gap-1.5">
          <nav aria-label="Fil d'Ariane" className="hidden gap-2 text-[13px] text-subtle lg:flex">
            <Link href="/wallet" className="font-semibold">
              Portefeuille
            </Link>
            <span aria-hidden>/</span>
            <span>Nouvelle opération</span>
          </nav>
          <h1 className="text-[22px] font-bold text-ink lg:text-[28px] lg:tracking-tight">Nouvelle opération</h1>
        </div>
        <SegmentedControl options={modeOptions} value={mode} onChange={(v) => setMode(v as 'sale' | 'expense')} />
      </div>

      {mode === 'sale' ? (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-[3_1_520px] flex-col gap-5">
            {/* --- 1. Article --- */}
            <Card className="flex flex-col gap-3.5 rounded-panel">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <h2 className="text-lg font-bold text-ink">
                  <span className="text-brand-300">1.</span> Article
                </h2>
                <div className="relative flex lg:block">
                  <Search className="pointer-events-none absolute left-3.5 top-2.5 size-[18px] text-subtle" />
                  <input
                    value={articleSearch}
                    onChange={(e) => setArticleSearch(e.target.value)}
                    placeholder="Rechercher un article"
                    className="h-11 w-full rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink outline-none lg:w-[260px]"
                  />
                </div>
              </div>
              {loadingArticles ? (
                <p className="py-6 text-center text-sm text-subtle">Chargement…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredArticles.map((article, i) => {
                    const active = String(article.id) === selectedArticleId
                    const stockCount = article.variations?.length
                      ? article.variations.reduce((s, v) => s + v.remaining_quantity, 0)
                      : article.remaining_quantity
                    return (
                      <button
                        key={article.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pickArticle(article)}
                        className={`flex flex-col gap-2 rounded-tile p-2.5 text-left ${
                          active ? 'border-2 border-brand-500 bg-brand-50' : 'border border-line bg-surface'
                        }`}
                      >
                        <span
                          className={`flex h-[76px] items-center justify-center rounded-tile text-xl font-extrabold ${THUMB_TINTS[i % THUMB_TINTS.length].bg} ${THUMB_TINTS[i % THUMB_TINTS.length].text}`}
                        >
                          {article.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-ink">{article.name}</span>
                          <span className="text-xs text-subtle">
                            {stockCount} en stock
                            {article.variations?.length ? ` · ${article.variations.length} variations` : ''}
                          </span>
                        </span>
                        <span className="text-sm font-bold text-ink">{formatAmount(article.sale_price)} F</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* --- 2. Variation / 3. Quantité --- */}
            <Card className="flex flex-col gap-4.5 rounded-panel">
              <VariationPicker
                variations={selectedArticle?.variations ?? []}
                selectedVariationId={selectedVariationId}
                onSelect={pickVariation}
                stepLabel="2."
              />

              <div className="flex flex-wrap items-end gap-6">
                <div className="flex flex-col gap-2.5">
                  <h2 className="text-lg font-bold text-ink">
                    <span className="text-brand-300">{selectedArticle?.variations?.length ? '3.' : '2.'}</span> Quantité
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Diminuer"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex size-12 items-center justify-center rounded-full border border-line-strong bg-surface text-xl font-bold text-ink"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      aria-label="Quantité"
                      value={quantity}
                      onChange={(e) => {
                        const next = parseInt(e.target.value, 10)
                        setQuantity(Number.isNaN(next) || next < 1 ? 1 : next)
                      }}
                      className="w-14 rounded-lg border border-line-strong bg-surface text-center text-2xl font-extrabold text-ink outline-none focus:border-brand-500"
                    />
                    <button
                      type="button"
                      aria-label="Augmenter"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="flex size-12 items-center justify-center rounded-full bg-brand-500 text-xl font-bold text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 5].map((q) => (
                    <button
                      key={q}
                      type="button"
                      aria-pressed={quantity === q}
                      onClick={() => setQuantity(q)}
                      className={`min-h-11 min-w-[52px] rounded-full text-sm font-bold ${
                        quantity === q ? 'bg-active text-white' : 'bg-surface-soft text-ink'
                      }`}
                    >
                      ×{q}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex flex-col gap-2">
                  <label htmlFor="unit-price" className="text-[13px] font-semibold text-ink">
                    Prix unitaire ({currency})
                  </label>
                  <input
                    id="unit-price"
                    value={unitPrice || (selectedArticle ? String(selectedArticle.sale_price) : '')}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    inputMode="numeric"
                    className="h-12 w-40 rounded-field border border-line-strong px-3.5 text-base font-bold text-ink"
                  />
                </div>
              </div>

              {overStock ? (
                <p role="alert" className="rounded-tile bg-danger-bg px-3.5 py-2.5 text-[13px] font-semibold text-danger-strong">
                  Quantité supérieure au stock disponible ({availableQuantity}).
                </p>
              ) : null}
            </Card>
          </div>

          {/* --- Récapitulatif --- */}
          <aside className="glass-panel flex flex-[2_1_340px] flex-col gap-4 rounded-panel p-5" aria-label="Récapitulatif">
            <h2 className="text-lg font-bold text-ink">Récapitulatif</h2>
            {selectedArticle ? (
              <div className="flex items-center gap-3.5 rounded-tile bg-surface p-3">
                <span className="flex size-[52px] shrink-0 items-center justify-center rounded-tile bg-brand-100 text-base font-extrabold text-brand-700">
                  {selectedArticle.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold text-ink">{selectedArticle.name}</span>
                  <span className="text-[13px] text-subtle">
                    {selectedVariation ? `Variation ${selectedVariation.name} · ` : ''}
                    {availableQuantity} en stock
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-subtle">Sélectionnez un article pour commencer.</p>
            )}
            <dl className="grid grid-cols-2 gap-2.5 text-sm">
              <dt className="text-ink-3">Prix unitaire</dt>
              <dd className="text-right font-semibold text-ink">{formatAmount(unitPriceNum)} F</dd>
              <dt className="text-ink-3">Quantité</dt>
              <dd className="text-right font-semibold text-ink">×{quantity}</dd>
              <dt className="text-ink-3">Stock après la vente</dt>
              <dd className={`text-right font-bold ${overStock ? 'text-danger-strong' : availableQuantity - quantity <= 2 ? 'text-warning' : 'text-success-strong'}`}>
                {overStock ? 'Insuffisant' : `${availableQuantity - quantity} restant(s)`}
              </dd>
            </dl>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-semibold text-ink-3">Total</span>
              <span className="text-[32px] font-extrabold tracking-[-0.03em] text-ink">
                {formatAmount(total)} <span className="text-base text-subtle">F</span>
              </span>
            </div>
            <label className="flex min-h-11 items-center gap-3 rounded-tile bg-surface p-3.5">
              <input
                type="checkbox"
                checked={generateInvoice}
                onChange={(e) => setGenerateInvoice(e.target.checked)}
                className="size-5 accent-brand-500"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">Générer une facture</span>
                <span className="text-xs text-subtle">La vente sera liée automatiquement</span>
              </span>
            </label>
            {generateInvoice ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="client" className="text-[13px] font-semibold text-ink">
                  Client
                </label>
                <select
                  id="client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={loadingClients}
                  className="h-[46px] rounded-field border border-line-strong bg-surface px-3 text-sm text-ink disabled:opacity-60"
                >
                  <option value="">
                    {loadingClients
                      ? 'Chargement…'
                      : clients.length === 0
                        ? 'Aucun client pour le moment'
                        : 'Choisir un client'}
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <Link href="/clients" className="text-xs font-semibold text-brand-600">
                  + Nouveau client…
                </Link>
              </div>
            ) : null}
            {/* Desktop seulement : sur mobile, la barre d'action fixe en bas
                de page (lg:hidden) est déjà l'unique bouton de soumission —
                un second bouton ici créerait un CTA en double, et la carte
                paraît "cassée" (grand vide avant la barre fixe) sur les
                écrans hauts (ex. iPhone 16 Pro Max). */}
            <Button
              variant="primary"
              className="hidden h-14 rounded-full text-base lg:flex"
              onClick={handleSaleSubmit}
              disabled={submittingSale || !selectedArticle || overStock}
            >
              {submittingSale ? 'Encaissement…' : `Encaisser ${formatAmount(total)} F`}
            </Button>
          </aside>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-4 rounded-panel">
            <h2 className="text-lg font-bold text-ink">Détails de la dépense</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <label htmlFor="expense-name" className="text-[13px] font-semibold text-ink">
                  Libellé
                </label>
                <input
                  id="expense-name"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  placeholder="Ex. Transport, loyer, électricité"
                  className="h-[50px] w-full min-w-0 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="expense-amount" className="text-[13px] font-semibold text-ink">
                Montant ({currency})
              </label>
              <input
                id="expense-amount"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="h-[60px] w-full min-w-0 rounded-tile border border-line-strong px-4 text-[28px] font-extrabold text-ink lg:h-[72px] lg:text-[34px]"
              />
            </div>
            {/* Desktop seulement : voir le commentaire équivalent sur le
                bouton "Encaisser" ci-dessus — même raison. */}
            <Button
              variant="primary"
              className="hidden self-end rounded-full px-6 lg:flex"
              onClick={handleExpenseSubmit}
              disabled={submittingExpense}
            >
              {submittingExpense ? 'Enregistrement…' : 'Enregistrer la dépense'}
            </Button>
          </Card>
        </div>
      )}

      {/* --- Barre d'action fixe mobile --- */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t border-line bg-surface p-4 pb-7 lg:hidden">
        {mode === 'sale' ? (
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-subtle">Total</span>
            <span className="text-2xl font-bold text-ink">
              {formatAmount(total)} <span className="text-sm text-subtle">{currency}</span>
            </span>
          </div>
        ) : null}
        <Button
          variant="primary"
          className="h-[54px] rounded-full text-base"
          onClick={mode === 'sale' ? handleSaleSubmit : handleExpenseSubmit}
          disabled={
            mode === 'sale'
              ? submittingSale || !selectedArticle || overStock
              : submittingExpense
          }
        >
          {mode === 'sale'
            ? submittingSale
              ? 'Enregistrement…'
              : 'Enregistrer la vente'
            : submittingExpense
              ? 'Enregistrement…'
              : 'Enregistrer la dépense'}
        </Button>
      </div>

      {/* --- Fermer (mobile) --- */}
      <Link
        href="/wallet"
        aria-label="Fermer"
        className="fixed left-4 top-[52px] z-30 flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden"
      >
        <X className="size-5" />
      </Link>
    </div>
  )
}
