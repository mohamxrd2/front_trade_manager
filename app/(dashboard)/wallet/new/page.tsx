'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, X, Plus, Minus, Check, Copy, ScanLine, Receipt } from 'lucide-react'

import { getArticles, type Article, type Variation } from '@/lib/services/articles'
import { getClients } from '@/lib/services/invoices'
import {
  createOperation,
  OperationStockError,
  OperationValidationError,
  type Operation,
  type SaleLinePayload,
} from '@/lib/services/operations'
import { createExpense, type TransactionPaymentMethod } from '@/lib/services/transactions'
import { keys } from '@/lib/query-keys'
import { invalidateAfterOperation } from '@/lib/invalidate'
import { isSilentError } from '@/lib/utils/error-handler'
import { useCurrency } from '@/lib/utils/currency'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { useCartStore, cartTotal, cartItemCount, type CartLine } from '@/lib/stores/cart'
import { readLastPaymentMethod, writeLastPaymentMethod } from '@/lib/wallet/last-payment-method'
import { Amount, Button, Card, SegmentedControl } from '@/components/waelly'
import { CheckoutFields } from '@/components/waelly/checkout-fields'
import { PaymentMethodChips } from '@/components/waelly/payment-method-chips'
import { VariationPicker } from '@/components/products'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const THUMB_TINTS = [
  { bg: 'bg-brand-100', text: 'text-brand-700' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]

function vibrateShort() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(50)
    } catch {
      // Best-effort — certains navigateurs refusent en dehors d'un geste utilisateur direct.
    }
  }
}

/**
 * Nouvelle vente — panier multi-articles (étape 3 du chantier "paniers
 * multi-articles"). Reprend l'esprit de design/maquettes/{mobile/Vente,
 * ordinateur/Web-Vente}.dc.html (recherche + grille d'articles, panneau en
 * verre), étendu à plusieurs lignes : les deux maquettes ne montraient
 * qu'un seul article à la fois (avant l'existence du panier côté API).
 *
 * La dépense garde EXACTEMENT son ancien formulaire à une ligne (ajout :
 * moyen de paiement facultatif + code affiché après validation).
 */
export default function NewTransactionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currency } = useCurrency()
  const { t } = useTranslation()

  const initialMode = searchParams.get('type') === 'expense' ? 'expense' : 'sale'
  const [mode, setMode] = React.useState<'sale' | 'expense'>(initialMode)

  const modeOptions = [
    { value: 'sale', label: t('wallet.new.modeOptionSale') },
    { value: 'expense', label: t('wallet.new.modeOptionExpense') },
  ]

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-col gap-1.5">
          <nav aria-label={t('products.breadcrumbAria')} className="hidden gap-2 text-[13px] text-subtle lg:flex">
            <Link href="/wallet" className="font-semibold">
              {t('wallet.title')}
            </Link>
            <span aria-hidden>/</span>
            <span>{mode === 'sale' ? t('wallet.new.pageTitleSale') : t('wallet.new.pageTitle')}</span>
          </nav>
          <h1 className="text-[22px] font-bold text-ink lg:text-[28px] lg:tracking-tight">
            {mode === 'sale' ? t('wallet.new.pageTitleSale') : t('wallet.new.pageTitle')}
          </h1>
        </div>
        <SegmentedControl options={modeOptions} value={mode} onChange={(v) => setMode(v as 'sale' | 'expense')} />
      </div>

      {mode === 'sale' ? (
        <SaleCart />
      ) : (
        <ExpenseForm currency={currency} router={router} />
      )}

      {/* --- Fermer (mobile) --- */}
      <Link
        href="/wallet"
        aria-label={t('common.close')}
        className="fixed left-4 top-[52px] z-30 flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden"
      >
        <X className="size-5" />
      </Link>
    </div>
  )
}

// ============================================================================
// Vente — panier multi-articles
// ============================================================================

function SaleCart() {
  const { t, language } = useTranslation()
  const cart = useCartStore()
  const lines = cart.lines

  const { data: articles = [], isLoading: loadingArticles } = useQuery({
    queryKey: keys.products.list(),
    queryFn: getArticles,
  })

  const [search, setSearch] = React.useState('')
  const [variationPickerArticle, setVariationPickerArticle] = React.useState<Article | null>(null)
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)
  const [justAddedId, setJustAddedId] = React.useState<string | null>(null)
  const [confirmedOperation, setConfirmedOperation] = React.useState<Operation | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const total = cartTotal(lines)
  const itemCount = cartItemCount(lines)

  const cartQuantityByArticle = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const line of lines) {
      map.set(line.articleId, (map.get(line.articleId) ?? 0) + line.quantity)
    }
    return map
  }, [lines])

  const filteredArticles = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return articles
    return articles.filter((a) => a.name.toLowerCase().includes(term))
  }, [articles, search])

  const flashLine = (id: string) => {
    setJustAddedId(id)
    vibrateShort()
    window.setTimeout(() => setJustAddedId((current) => (current === id ? null : current)), 350)
  }

  const addSimpleArticle = (article: Article) => {
    if (article.remaining_quantity <= 0) return
    cart.addLine({
      articleId: String(article.id),
      variationId: null,
      articleName: article.name,
      variationName: null,
      unitPrice: article.sale_price,
      maxStock: article.remaining_quantity,
    })
    flashLine(`${article.id}:`)
  }

  const addVariation = (article: Article, variation: Variation) => {
    cart.addLine({
      articleId: String(article.id),
      variationId: variation.id,
      articleName: article.name,
      variationName: variation.name,
      unitPrice: variation.price,
      maxStock: variation.remaining_quantity,
    })
    flashLine(`${article.id}:${variation.id}`)
    setVariationPickerArticle(null)
  }

  const pickArticle = (article: Article) => {
    if (article.type === 'variable') {
      setVariationPickerArticle(article)
    } else {
      addSimpleArticle(article)
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const first = filteredArticles[0]
      if (first) pickArticle(first)
    }
  }

  // Raccourci ordinateur : "/" focalise la recherche (sauf si un champ est déjà actif).
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const active = document.activeElement
      const isTyping = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      if (isTyping) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Idempotency-Key : générée dès qu'il y a quelque chose à encaisser,
  // réutilisée pour tous les essais tant que le panier n'a pas changé de
  // contenu de façon significative (voir handleSubmitSale ci-dessous).
  React.useEffect(() => {
    if (lines.length > 0) cart.ensureIdempotencyKey()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length])

  if (confirmedOperation) {
    return (
      <SaleConfirmation
        operation={confirmedOperation}
        onNewSale={() => {
          cart.clear()
          setConfirmedOperation(null)
        }}
      />
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      {/* --- Colonne gauche : recherche + grille --- */}
      <div className="flex min-w-0 flex-[3_1_520px] flex-col gap-5">
        <Card className="flex flex-col gap-3.5 rounded-panel">
          <div className="flex items-center gap-2">
            <div className="relative flex min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-subtle" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('wallet.new.searchArticlePlaceholder')}
                aria-label={t('wallet.new.searchArticlePlaceholder')}
                className="h-12 w-full min-w-0 rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink outline-none focus:border-brand-500"
              />
            </div>
            {/* Réservé pour le scan de code-barres (étape à venir) — non actif. */}
            <button
              type="button"
              disabled
              aria-disabled
              aria-label={t('wallet.new.scanButton')}
              title={t('wallet.new.scanComingSoon')}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-soft text-subtle opacity-60"
            >
              <ScanLine className="size-5" />
            </button>
          </div>

          {loadingArticles ? (
            <p className="py-6 text-center text-sm text-subtle">{t('products.detail.loading')}</p>
          ) : filteredArticles.length === 0 ? (
            <p className="py-6 text-center text-sm text-subtle">{t('wallet.new.noArticlesFound')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredArticles.map((article, i) => {
                const inCartQty = cartQuantityByArticle.get(String(article.id)) ?? 0
                const displayedRemaining = Math.max(0, article.remaining_quantity - inCartQty)
                const hasRange = article.type === 'variable' && article.price_max != null && article.price_max !== article.sale_price
                const priceNode = hasRange ? (
                  <>
                    <Amount value={article.sale_price} />–<Amount value={article.price_max as number} /> F
                  </>
                ) : (
                  <>
                    <Amount value={article.sale_price} /> F
                  </>
                )
                const soldOut = displayedRemaining <= 0
                return (
                  <button
                    key={article.id}
                    type="button"
                    disabled={soldOut}
                    onClick={() => pickArticle(article)}
                    className="flex flex-col gap-2 rounded-tile border border-line bg-surface p-2.5 text-left disabled:opacity-50"
                  >
                    <span
                      className={`flex h-[76px] items-center justify-center rounded-tile text-xl font-extrabold ${THUMB_TINTS[i % THUMB_TINTS.length].bg} ${THUMB_TINTS[i % THUMB_TINTS.length].text}`}
                    >
                      {article.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="truncate text-sm font-bold text-ink">{article.name}</span>
                      <span className="text-xs text-subtle">
                        {soldOut
                          ? t('wallet.new.outOfStock')
                          : t('wallet.new.inStockCount', { count: displayedRemaining })}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-ink">{priceNode}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* --- Colonne droite : panier + encaissement (ordinateur) --- */}
      <aside className="glass-panel flex min-w-0 flex-[2_1_380px] flex-col gap-4 rounded-panel p-5" aria-label={t('wallet.cart.title')}>
        <h2 className="text-lg font-bold text-ink">{t('wallet.cart.title')}</h2>
        <CartLines lines={lines} justAddedId={justAddedId} />

        {lines.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-semibold text-ink-3">
                {t('wallet.cart.itemsAndTotal', { count: itemCount, total: formatAmount(total, language) })}
              </span>
            </div>
            {/* Ordinateur : encaissement inline dans le même panneau, pas de bottom sheet. */}
            <div className="hidden lg:flex lg:flex-col lg:gap-4">
              <SaleCheckoutForm total={total} onSuccess={(operation) => setConfirmedOperation(operation)} />
            </div>
            <Button
              variant="primary"
              className="h-14 rounded-full text-base lg:hidden"
              onClick={() => setCheckoutOpen(true)}
            >
              {t('wallet.cart.checkoutButton')}
            </Button>
          </>
        ) : (
          <EmptyCartState />
        )}
      </aside>

      {/* --- Sélecteur de variation (popup) --- */}
      <VariationPickerPopup
        article={variationPickerArticle}
        onClose={() => setVariationPickerArticle(null)}
        onSelect={(variation) => variationPickerArticle && addVariation(variationPickerArticle, variation)}
      />

      {/* --- Bottom sheet "Encaissement" (mobile) --- */}
      <Drawer open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DrawerContent className="px-5 pb-8 pt-2.5">
          <DrawerHeader className="mt-1.5">
            <DrawerTitle>{t('wallet.checkout.title')}</DrawerTitle>
          </DrawerHeader>
          <div className="mt-3.5 max-h-[70vh] overflow-y-auto">
            <SaleCheckoutForm
              total={total}
              onSuccess={(operation) => {
                setCheckoutOpen(false)
                setConfirmedOperation(operation)
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* --- Pied fixe mobile : total + Encaisser --- */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t border-line bg-surface p-4 pb-7 lg:hidden">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-subtle">
              {t('wallet.cart.itemsAndTotal', { count: itemCount, total: formatAmount(total, language) })}
            </span>
          </div>
          <Button variant="primary" className="h-[54px] rounded-full text-base" onClick={() => setCheckoutOpen(true)}>
            {t('wallet.cart.checkoutButton')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function EmptyCartState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2 rounded-tile bg-surface-soft py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <Plus className="size-6" />
      </span>
      <p className="text-sm font-semibold text-subtle">{t('wallet.cart.emptyState')}</p>
    </div>
  )
}

function CartLines({ lines, justAddedId }: { lines: CartLine[]; justAddedId: string | null }) {
  const cart = useCartStore()
  const { t } = useTranslation()
  const [editingPriceId, setEditingPriceId] = React.useState<string | null>(null)
  const [priceDraft, setPriceDraft] = React.useState('')

  if (lines.length === 0) return null

  return (
    <div className="flex flex-col gap-2.5">
      {lines.map((line) => {
        const subtotal = line.unitPrice * line.quantity
        const atMax = line.quantity >= Math.max(line.maxStock, 1)
        const isEditingPrice = editingPriceId === line.id
        return (
          <div
            key={line.id}
            className={`flex flex-col gap-2 rounded-tile border border-line bg-surface p-3 transition-transform duration-300 ${
              justAddedId === line.id ? 'scale-[1.02] ring-2 ring-brand-300' : 'scale-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-bold text-ink">{line.articleName}</span>
                {line.variationName ? <span className="text-xs text-subtle">{line.variationName}</span> : null}
              </div>
              <button
                type="button"
                aria-label={t('wallet.cart.removeLine')}
                onClick={() => cart.removeLine(line.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink-3"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {isEditingPrice ? (
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => {
                    const parsed = parseFloat(priceDraft)
                    if (!isNaN(parsed)) cart.updatePrice(line.id, parsed)
                    setEditingPriceId(null)
                  }}
                  className="h-9 w-28 rounded-field border border-line-strong px-2 text-sm font-bold text-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPriceId(line.id)
                    setPriceDraft(String(line.unitPrice))
                  }}
                  className="rounded-full border border-dashed border-line-strong px-3 py-1 text-xs font-semibold text-ink-2"
                >
                  <Amount value={line.unitPrice} /> F {t('wallet.cart.editPriceHint')}
                </button>
              )}

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={t('products.decrease')}
                  onClick={() => cart.updateQuantity(line.id, line.quantity - 1)}
                  className="flex size-9 items-center justify-center rounded-full border border-line-strong bg-surface text-ink"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-base font-extrabold text-ink">{line.quantity}</span>
                <button
                  type="button"
                  aria-label={t('products.increase')}
                  disabled={atMax}
                  onClick={() => cart.updateQuantity(line.id, line.quantity + 1)}
                  className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-white disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <span className="text-sm font-bold text-ink">
                <Amount value={subtotal} /> F
              </span>
            </div>

            {atMax ? (
              <p className="text-xs font-semibold text-warning">{t('wallet.cart.stockMax', { count: line.maxStock })}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function VariationPickerPopup({
  article,
  onClose,
  onSelect,
}: {
  article: Article | null
  onClose: () => void
  onSelect: (variation: Variation) => void
}) {
  const { t } = useTranslation()
  const open = article !== null

  const content = article ? (
    <VariationPicker variations={article.variations ?? []} selectedVariationId={null} onSelect={onSelect} />
  ) : null

  return (
    <>
      <div className="lg:hidden">
        <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
          <DrawerContent className="px-5 pb-8 pt-2.5">
            <DrawerHeader className="mt-1.5">
              <DrawerTitle>{article?.name ?? t('products.variationPicker.title')}</DrawerTitle>
            </DrawerHeader>
            <div className="mt-3.5">{content}</div>
          </DrawerContent>
        </Drawer>
      </div>
      <div className="hidden lg:block">
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
          <DialogPortal>
            <DialogOverlay className="bg-[rgba(14,14,26,0.42)] backdrop-blur-[4px]" />
            <DialogContent className="w-[calc(100%-2.5rem)] max-w-[480px] rounded-[26px] border-none bg-surface p-6 shadow-[0_40px_90px_rgba(10,10,60,0.35)]">
              <DialogTitle className="text-lg font-bold text-ink">{article?.name ?? t('products.variationPicker.title')}</DialogTitle>
              {content}
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </div>
    </>
  )
}

interface SaleCheckoutFormProps {
  total: number
  onSuccess: (operation: Operation) => void
}

function SaleCheckoutForm({ total, onSuccess }: SaleCheckoutFormProps) {
  const { t, language } = useTranslation()
  const cart = useCartStore()

  const [paymentMethod, setPaymentMethod] = React.useState<TransactionPaymentMethod | ''>(() => readLastPaymentMethod() ?? '')
  const [amountReceived, setAmountReceived] = React.useState<number | null>(null)
  const [clientId, setClientId] = React.useState('')
  const [note, setNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [stockErrors, setStockErrors] = React.useState<Map<string, number>>(new Map())
  const [clientsFetched, setClientsFetched] = React.useState(false)

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: keys.clients.all,
    queryFn: () => getClients(),
    enabled: clientsFetched,
  })

  const handleSubmit = async () => {
    if (!paymentMethod) {
      toast.error(t('wallet.checkout.errors.paymentMethodRequired'))
      return
    }
    if (cart.lines.length === 0) return

    const idempotencyKey = cart.ensureIdempotencyKey()
    const lines: SaleLinePayload[] = cart.lines.map((l) => ({
      article_id: l.articleId,
      variation_id: l.variationId,
      quantity: l.quantity,
      unit_price: l.unitPrice,
    }))

    setSubmitting(true)
    setStockErrors(new Map())
    try {
      const operation = await createOperation(
        {
          type: 'sale',
          payment_method: paymentMethod,
          client_id: clientId || null,
          note: note.trim() || undefined,
          amount_received: amountReceived ?? undefined,
          lines,
        },
        idempotencyKey
      )

      writeLastPaymentMethod(paymentMethod)
      invalidateAfterOperation(cart.lines.map((l) => l.articleId))
      cart.resetIdempotencyKey()
      onSuccess(operation)
    } catch (error) {
      if (isSilentError(error)) return
      if (error instanceof OperationStockError) {
        const nextErrors = new Map<string, number>()
        error.lines.forEach((line) => {
          const cartLine = cart.lines[line.index]
          if (cartLine) nextErrors.set(cartLine.id, line.available)
        })
        setStockErrors(nextErrors)
        toast.error(t('wallet.checkout.errors.stock'))
      } else if (error instanceof OperationValidationError) {
        toast.error(error.message)
      } else {
        toast.error(error instanceof Error ? error.message : t('wallet.checkout.errors.generic'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {stockErrors.size > 0 ? (
        <div className="flex flex-col gap-2 rounded-tile bg-danger-bg p-3.5" role="alert">
          <p className="text-sm font-bold text-danger-strong">{t('wallet.checkout.errors.stock')}</p>
          {cart.lines
            .filter((l) => stockErrors.has(l.id))
            .map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-danger-strong">
                  {l.articleName}
                  {l.variationName ? ` · ${l.variationName}` : ''} — {t('wallet.checkout.errors.available', { count: stockErrors.get(l.id) ?? 0 })}
                </span>
                <button
                  type="button"
                  onClick={() => cart.clampLineToStock(l.id, stockErrors.get(l.id) ?? 0)}
                  className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-danger-strong"
                >
                  {t('wallet.checkout.errors.adjust')}
                </button>
              </div>
            ))}
        </div>
      ) : null}

      <CheckoutFields
        total={total}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        amountReceived={amountReceived}
        onAmountReceivedChange={setAmountReceived}
        clientId={clientId}
        onClientIdChange={(id) => {
          setClientId(id)
          setClientsFetched(true)
        }}
        clients={clients}
        loadingClients={loadingClients}
        note={note}
        onNoteChange={setNote}
      />

      <Button
        variant="primary"
        className="h-[54px] w-full rounded-full text-base"
        onClick={handleSubmit}
        disabled={submitting || !paymentMethod}
      >
        {submitting
          ? t('wallet.checkout.submitBusy')
          : t('wallet.checkout.submitIdle', { amount: formatAmount(total, language) })}
      </Button>
    </div>
  )
}

function SaleConfirmation({ operation, onNewSale }: { operation: Operation; onNewSale: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(operation.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Best-effort — certains navigateurs/contextes non sécurisés refusent l'accès au presse-papiers.
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-5 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-success-bg text-success-strong">
        <Check className="size-8" strokeWidth={2.5} />
      </span>
      <h2 className="text-xl font-bold text-ink">{t('wallet.confirmation.saleRecorded')}</h2>

      <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-3">
        <span className="font-mono text-lg font-extrabold tracking-wide text-ink">{operation.code}</span>
        <button
          type="button"
          onClick={copyCode}
          aria-label={t('wallet.confirmation.copyCode')}
          className="flex size-8 items-center justify-center rounded-full bg-surface-soft text-ink-3"
        >
          <Copy className="size-4" />
        </button>
        {copied ? <span className="text-xs font-semibold text-success-strong">{t('wallet.confirmation.copied')}</span> : null}
      </div>

      <Card className="w-full rounded-panel text-left">
        <div className="flex flex-col divide-y divide-divider">
          {operation.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-ink-2">
                {line.articleName || line.name}
                {line.variationName ? ` · ${line.variationName}` : ''}
                {line.quantity && line.quantity > 1 ? ` ×${line.quantity}` : ''}
              </span>
              <span className="font-semibold text-ink">
                <Amount value={line.amount} /> F
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 pt-2.5 text-sm font-bold">
            <span className="text-ink">{t('wallet.new.total')}</span>
            <span className="text-ink">
              <Amount value={operation.totalAmount} /> F
            </span>
          </div>
          {operation.changeGiven != null && operation.changeGiven > 0 ? (
            <div className="flex items-center justify-between gap-3 pt-2.5 text-sm">
              <span className="text-ink-2">{t('wallet.checkout.changeLabel')}</span>
              <span className="font-bold text-success-strong">
                <Amount value={operation.changeGiven} /> F
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex w-full flex-col gap-2.5 lg:flex-row">
        <Button variant="secondary" className="h-14 w-full flex-1 rounded-full text-base" onClick={onNewSale}>
          {t('wallet.confirmation.newSale')}
        </Button>
        <Link
          href="/wallet"
          className="flex h-14 w-full flex-1 items-center justify-center rounded-full bg-ink text-base font-bold text-white"
        >
          {t('wallet.confirmation.viewTransaction')}
        </Link>
      </div>
      {/* Réservé pour "Ticket / Partager" (étape à venir) — non actif. */}
      <button
        type="button"
        disabled
        aria-disabled
        title={t('wallet.confirmation.ticketComingSoon')}
        className="flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-sm font-semibold text-subtle opacity-60"
      >
        <Receipt className="size-4" />
        {t('wallet.confirmation.ticketButton')}
      </button>
    </div>
  )
}

// ============================================================================
// Dépense — formulaire inchangé + moyen de paiement + code après validation
// ============================================================================

function ExpenseForm({
  currency,
  router,
}: {
  currency: string
  router: ReturnType<typeof useRouter>
}) {
  const { t } = useTranslation()
  const [expenseName, setExpenseName] = React.useState('')
  const [expenseAmount, setExpenseAmount] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState<TransactionPaymentMethod | ''>(() => readLastPaymentMethod() ?? '')
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmedCode, setConfirmedCode] = React.useState<string | null>(null)

  const handleExpenseSubmit = async () => {
    if (!expenseName.trim() || expenseName.trim().length < 2) {
      toast.error(t('wallet.new.expenseLabelRequired'))
      return
    }
    const amountNum = parseFloat(expenseAmount)
    if (isNaN(amountNum) || amountNum < 0.01) {
      toast.error(t('wallet.new.expenseAmountPositive'))
      return
    }

    const idempotencyKey = crypto.randomUUID()
    setSubmitting(true)
    try {
      const created = await createExpense(
        {
          name: expenseName.trim(),
          amount: amountNum,
          payment_method: paymentMethod || undefined,
        },
        idempotencyKey
      )
      toast.success(t('wallet.new.expenseRecorded'))
      if (paymentMethod) writeLastPaymentMethod(paymentMethod)
      invalidateAfterOperation([])
      setConfirmedCode(created.operation_code ?? null)
    } catch (error: unknown) {
      if (isSilentError(error)) return
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      toast.error(axiosError.response?.data?.message || t('wallet.new.expenseFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmedCode) {
    return (
      <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-5 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-bg text-success-strong">
          <Check className="size-8" strokeWidth={2.5} />
        </span>
        <h2 className="text-xl font-bold text-ink">{t('wallet.new.expenseRecorded')}</h2>
        <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface px-5 py-3">
          <span className="font-mono text-lg font-extrabold tracking-wide text-ink">{confirmedCode}</span>
        </div>
        <div className="flex w-full flex-col gap-2.5 lg:flex-row">
          <Button
            variant="secondary"
            className="h-14 w-full flex-1 rounded-full text-base"
            onClick={() => {
              setExpenseName('')
              setExpenseAmount('')
              setConfirmedCode(null)
            }}
          >
            {t('wallet.confirmation.newExpense')}
          </Button>
          <Button variant="primary" className="h-14 w-full flex-1 rounded-full text-base" onClick={() => router.push('/wallet')}>
            {t('wallet.confirmation.viewTransaction')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <Card className="flex min-w-0 flex-[3_1_480px] flex-col gap-4 rounded-panel">
        <h2 className="text-lg font-bold text-ink">{t('wallet.new.expenseDetailsTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="expense-name" className="text-[13px] font-semibold text-ink">
              {t('wallet.new.expenseLabelField')}
            </label>
            <input
              id="expense-name"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder={t('wallet.new.expenseLabelPlaceholder')}
              className="h-[50px] w-full min-w-0 rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="expense-amount" className="text-[13px] font-semibold text-ink">
            {t('wallet.new.expenseAmountLabel', { currency })}
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
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">{t('wallet.deposit.paymentMethodLabel')}</span>
          <PaymentMethodChips value={paymentMethod} onChange={setPaymentMethod} />
        </div>
        <Button
          variant="primary"
          className="hidden self-end rounded-full px-6 lg:flex"
          onClick={handleExpenseSubmit}
          disabled={submitting}
        >
          {submitting ? t('products.saving') : t('wallet.new.expenseSaveIdle')}
        </Button>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t border-line bg-surface p-4 pb-7 lg:hidden">
        <Button variant="primary" className="h-[54px] rounded-full text-base" onClick={handleExpenseSubmit} disabled={submitting}>
          {submitting ? t('products.saving') : t('wallet.new.expenseSaveIdle')}
        </Button>
      </div>
    </div>
  )
}
