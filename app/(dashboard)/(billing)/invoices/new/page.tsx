'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { Plus, Search, X } from 'lucide-react'

import { getArticles, type Article, type Variation } from '@/lib/services/articles'
import { invalidateInvoices } from '@/lib/invalidate'
import {
  getClients,
  createInvoice,
  checkCompanyProfile,
  type Client,
  type CreateInvoicePayload,
  type Invoice,
  type InvoiceTheme,
} from '@/lib/services/invoices'
import { ClientFormDialog } from '@/components/clients/client-form-dialog'
import { InvoicePreviewCard } from '@/components/invoices/invoice-preview-card'
import { VariationPicker } from '@/components/products'
import { Button, Card } from '@/components/waelly'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function buildThemeOptions(t: ReturnType<typeof useTranslation>['t']): { value: InvoiceTheme; label: string; dot: string }[] {
  return [
    { value: 'modern', label: t('invoices.themes.modern'), dot: 'bg-[#1d4ed8]' },
    { value: 'classic', label: t('invoices.themes.classic'), dot: 'bg-[#1a1a1a]' },
    { value: 'professional', label: t('invoices.themes.professional'), dot: 'bg-[#1c2431]' },
    { value: 'minimal', label: t('invoices.themes.minimal'), dot: 'bg-[#DADADF]' },
  ]
}

interface InvoiceLine {
  id: string
  article: Article
  variation: Variation | null
  quantity: number
  unitPrice: number
}

/**
 * Nouvelle facture — reprend design/maquettes/ordinateur/Web-NouvelleFacture.dc.html
 * (≥ 1024px) et design/maquettes/mobile/NouvelleFacture.dc.html (< 768px).
 * Remplace l'ancien assistant à 5 étapes (components/invoices/invoice-form/*,
 * conservé pour l'instant mais plus utilisé par cette page) par un formulaire
 * en une seule page, dans le même style que /wallet/new et /products/new.
 *
 * Écarts assumés :
 * - Pas de "Ligne libre" : chaque ligne de facture DOIT référencer un
 *   article réel (items.*.article_id est obligatoire côté API) — impossible
 *   de facturer un libellé libre sans article. Seul "+ Depuis le stock"
 *   existe ici.
 * - Pas de bouton "Télécharger PDF" ni de numéro de facture dans l'en-tête
 *   avant l'enregistrement : il n'existe aucun endpoint de mise à jour
 *   d'une facture après création (seul le statut peut changer ensuite), et
 *   le PDF/numéro ne sont générés qu'après la création. La maquette suppose
 *   un brouillon déjà auto-enregistré, ce qu'aucun endpoint ne permet ici.
 * - Un article variable exige de choisir une variation pour chaque ligne
 *   (même sélecteur en chips que /wallet/new, components/products/variation-picker) :
 *   le prix par défaut proposé est celui de la variation, jamais celui
 *   (min/max) de l'article.
 * - L'avertissement de stock insuffisant est indicatif (pas un blocage) :
 *   le stock n'est décrémenté par l'API qu'au passage au statut "payée",
 *   jamais à la création d'une facture brouillon/envoyée.
 */
export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language } = useTranslation()
  const THEME_OPTIONS = React.useMemo(() => buildThemeOptions(t), [t])
  const preselectClientId = searchParams.get('client')

  const [clients, setClients] = React.useState<Client[]>([])
  const [loadingClients, setLoadingClients] = React.useState(true)
  const [clientId, setClientId] = React.useState('')
  const [clientDialogOpen, setClientDialogOpen] = React.useState(false)

  const [articles, setArticles] = React.useState<Article[]>([])
  const [loadingArticles, setLoadingArticles] = React.useState(true)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [articleSearch, setArticleSearch] = React.useState('')
  const [lines, setLines] = React.useState<InvoiceLine[]>([])
  // Article variable cliqué dans le picker, en attente du choix de variation
  // avant de devenir une vraie ligne.
  const [pendingVariationArticle, setPendingVariationArticle] = React.useState<Article | null>(null)

  const [discountMode, setDiscountMode] = React.useState<'pct' | 'amt'>('pct')
  const [discountValue, setDiscountValue] = React.useState('0')
  const [taxPercent, setTaxPercent] = React.useState('0')
  const [shippingFee, setShippingFee] = React.useState('0')
  const [notes, setNotes] = React.useState(t('invoices.new.defaultNotes'))
  const [dueDate, setDueDate] = React.useState(dayjs().add(15, 'day').format('YYYY-MM-DD'))
  const [theme, setTheme] = React.useState<InvoiceTheme>('modern')

  const [companyName, setCompanyName] = React.useState('')
  const [companyCity, setCompanyCity] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState<'draft' | 'send' | null>(null)
  const submittingRef = React.useRef(false)

  React.useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => toast.error(t('wallet.new.errorLoadClients')))
      .finally(() => setLoadingClients(false))

    getArticles()
      .then(setArticles)
      .catch(() => toast.error(t('wallet.new.errorLoadArticles')))
      .finally(() => setLoadingArticles(false))

    checkCompanyProfile()
      .then(({ company }) => {
        setCompanyName(company?.name ?? '')
        setCompanyCity(company?.headquarters ?? null)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (preselectClientId) setClientId(preselectClientId)
  }, [preselectClientId])

  const selectedClient = clients.find((c) => c.id === clientId) ?? null

  const filteredArticles = React.useMemo(
    () => articles.filter((a) => a.name.toLowerCase().includes(articleSearch.trim().toLowerCase())),
    [articles, articleSearch]
  )

  const addLine = (article: Article, variation: Variation | null) => {
    setLines((prev) => [
      ...prev,
      {
        id: `${article.id}-${variation?.id ?? 'simple'}-${Date.now()}`,
        article,
        variation,
        quantity: 1,
        unitPrice: variation ? variation.price : article.sale_price,
      },
    ])
    setPickerOpen(false)
    setPendingVariationArticle(null)
    setArticleSearch('')
  }

  // Un article variable exige de choisir sa variation avant de devenir une
  // ligne (même règle que pour une vente) — un article simple est ajouté
  // directement.
  const handlePickArticleFromStock = (article: Article) => {
    if (article.variations?.length) {
      setPendingVariationArticle(article)
      return
    }
    addLine(article, null)
  }

  const updateLineQuantity = (id: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: Math.max(1, quantity) } : l)))
  }

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const discountAmount =
    discountMode === 'pct' ? subtotal * ((parseFloat(discountValue) || 0) / 100) : parseFloat(discountValue) || 0
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxAmount = afterDiscount * ((parseFloat(taxPercent) || 0) / 100)
  const shippingFeeNum = parseFloat(shippingFee) || 0
  const total = afterDiscount + taxAmount + shippingFeeNum

  const effectiveDiscountPercent =
    discountMode === 'pct' ? parseFloat(discountValue) || 0 : subtotal > 0 ? (discountAmount / subtotal) * 100 : 0

  const previewInvoice: Invoice | null = selectedClient
    ? ({
        id: '',
        user_id: '',
        company_id: '',
        client_id: selectedClient.id,
        invoice_number: t('invoices.preview'),
        status: 'draft',
        theme,
        subtotal: String(subtotal),
        discount_percent: String(effectiveDiscountPercent),
        discount_amount: String(discountAmount),
        tax_percent: String(parseFloat(taxPercent) || 0),
        tax_amount: String(taxAmount),
        shipping_fee: String(shippingFeeNum),
        total: String(total),
        billing_address: selectedClient.billing_address,
        shipping_address: selectedClient.shipping_address,
        notes,
        terms: null,
        issued_at: dayjs().format('YYYY-MM-DD'),
        due_date: dueDate,
        paid_at: null,
        is_overdue: false,
        days_until_due: null,
        formatted_total: `${formatAmount(total, language)} F`,
        client: selectedClient,
        company: { id: '', name: companyName, email: '', logo_url: null, headquarters: companyCity },
        items: lines.map((l) => ({
          id: l.id,
          invoice_id: '',
          article_id: String(l.article.id),
          variation_id: l.variation?.id ?? null,
          name_snapshot: l.variation ? `${l.article.name} (${l.variation.name})` : l.article.name,
          quantity: l.quantity,
          unit_price: String(l.unitPrice),
          discount_percent: '0',
          discount_amount: '0',
          total_line: String(l.quantity * l.unitPrice),
          article: { id: String(l.article.id), name: l.article.name, image: l.article.image ?? null },
        })),
      } as Invoice)
    : null

  const handleSubmit = async (status: 'draft' | 'unpaid') => {
    if (submittingRef.current) return

    if (!clientId) {
      toast.error(t('invoices.new.selectClient'))
      return
    }
    if (lines.length === 0) {
      toast.error(t('invoices.new.addAtLeastOneLine'))
      return
    }

    submittingRef.current = true
    setSubmitting(status === 'draft' ? 'draft' : 'send')
    try {
      const payload: CreateInvoicePayload = {
        client_id: clientId,
        items: lines.map((l) => ({
          article_id: String(l.article.id),
          variation_id: l.variation?.id,
          quantity: l.quantity,
          unit_price: l.unitPrice,
        })),
        discount_percent: effectiveDiscountPercent,
        tax_percent: parseFloat(taxPercent) || 0,
        shipping_fee: shippingFeeNum,
        notes: notes || undefined,
        due_date: dueDate,
        theme,
        status,
      }
      const invoice = await createInvoice(payload)
      invalidateInvoices()
      toast.success(status === 'draft' ? t('invoices.new.draftSaved') : t('invoices.detail.toastSent'))
      router.push(`/invoices/${invoice.id}`)
    } catch (err: unknown) {
      const error = err as { status?: number; errors?: unknown; message?: string }
      if (error.status === 422 && Array.isArray(error.errors) && error.errors.length > 0) {
        error.errors.forEach((m) => toast.error(String(m)))
      } else if (error.status === 422 && error.errors && typeof error.errors === 'object') {
        const first = Object.values(error.errors as Record<string, string[]>)[0]
        toast.error(Array.isArray(first) ? first[0] : error.message || t('clients.form.errorSaveFailed'))
      } else {
        toast.error(error.message || t('clients.form.errorSaveFailed'))
      }
    } finally {
      submittingRef.current = false
      setSubmitting(null)
    }
  }

  const articlePicker = (
    <div className="flex flex-col gap-2 rounded-tile border border-line bg-surface-soft p-3">
      {pendingVariationArticle ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{pendingVariationArticle.name}</span>
            <button
              type="button"
              onClick={() => setPendingVariationArticle(null)}
              className="text-xs font-semibold text-subtle"
            >
              {t('invoices.new.changeArticle')}
            </button>
          </div>
          <VariationPicker
            variations={pendingVariationArticle.variations ?? []}
            selectedVariationId={null}
            onSelect={(variation) => addLine(pendingVariationArticle, variation)}
          />
        </div>
      ) : (
        <>
          <div className="relative flex">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-subtle" />
            <input
              autoFocus
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder={t('wallet.new.searchArticlePlaceholder')}
              className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none"
            />
          </div>
          <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
            {loadingArticles ? (
              <p className="py-3 text-center text-sm text-subtle">{t('products.detail.loading')}</p>
            ) : filteredArticles.length === 0 ? (
              <p className="py-3 text-center text-sm text-subtle">{t('invoices.new.noArticles')}</p>
            ) : (
              filteredArticles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => handlePickArticleFromStock(article)}
                  className="flex items-center justify-between gap-2.5 rounded-tile px-2.5 py-2 text-left hover:bg-surface"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{article.name}</span>
                    <span className="text-xs text-subtle">
                      {t('wallet.new.inStockCount', { count: article.remaining_quantity })}
                      {article.variations?.length ? t('wallet.new.variationsCount', { count: article.variations.length }) : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink">
                    {article.variations?.length
                      ? article.price_max && article.price_max !== article.sale_price
                        ? `${formatAmount(article.sale_price, language)} – ${formatAmount(article.price_max, language)} F`
                        : `${formatAmount(article.sale_price, language)} F`
                      : `${formatAmount(article.sale_price, language)} F`}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )

  const linesTable = (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold text-ink">{t('invoices.new.linesLabel')}</span>
      {lines.length > 0 ? (
        <div className="overflow-x-auto rounded-tile border border-line">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-soft text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                <th className="px-3 py-2.5">{t('invoices.new.colDesignation')}</th>
                <th className="px-3 py-2.5">{t('invoices.new.colQty')}</th>
                <th className="px-3 py-2.5">{t('invoices.new.colUnitPrice')}</th>
                <th className="px-3 py-2.5 text-right">{t('invoices.total')}</th>
                <th className="px-3 py-2.5">
                  <span className="sr-only">{t('products.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const availableForLine = line.variation ? line.variation.remaining_quantity : line.article.remaining_quantity
                const stockWarning = line.quantity > availableForLine
                return (
                  <tr key={line.id} className="border-t border-divider align-top">
                    <td className="px-3 py-2.5">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold text-ink">
                          {line.article.name}
                          {line.variation ? ` (${line.variation.name})` : ''}
                        </span>
                        <span className="text-xs text-subtle">
                          {t('invoices.new.fromStock')}
                          {stockWarning ? (
                            <span className="ml-1 font-semibold text-danger-strong">
                              {t('invoices.new.stockAvailable', { available: availableForLine })}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={t('products.decrease')}
                          onClick={() => updateLineQuantity(line.id, line.quantity - 1)}
                          className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLineQuantity(line.id, parseInt(e.target.value, 10) || 1)}
                          className="w-10 rounded-lg border border-line-strong text-center text-sm font-bold text-ink outline-none"
                        />
                        <button
                          type="button"
                          aria-label={t('products.increase')}
                          onClick={() => updateLineQuantity(line.id, line.quantity + 1)}
                          className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatAmount(line.unitPrice, language)} F</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-ink">
                      {formatAmount(line.quantity * line.unitPrice, language)} F
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label={t('invoices.new.removeLineAria')}
                        onClick={() => removeLine(line.id)}
                        className="inline-flex size-9 items-center justify-center rounded-full text-subtle"
                      >
                        <X className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {pickerOpen ? (
        articlePicker
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-[42px] items-center justify-center gap-1.5 self-start rounded-full border border-brand-200 bg-brand-50 px-4 text-[13px] font-bold text-brand-700"
        >
          <Plus className="size-4" />
          {t('invoices.new.fromStock')}
        </button>
      )}
    </div>
  )

  const clientSelect = (
    <div className="flex flex-col gap-2">
      <label htmlFor="invoice-client" className="text-[13px] font-semibold text-ink">
        {t('invoices.client')}
      </label>
      <select
        id="invoice-client"
        value={clientId}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setClientDialogOpen(true)
            return
          }
          setClientId(e.target.value)
        }}
        className="h-12 rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
      >
        <option value="">{loadingClients ? t('wallet.new.loadingClientsOption') : t('wallet.new.chooseClientOption')}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__new__">{t('invoices.new.newClientOption')}</option>
      </select>
    </div>
  )

  const discountTaxShipping = (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <span className="flex items-center justify-between">
          <label htmlFor="invoice-discount" className="text-[13px] font-semibold text-ink">
            {t('invoices.discount')}
          </label>
          <span className="flex gap-0.5 rounded-xl bg-canvas p-0.5">
            <button
              type="button"
              aria-pressed={discountMode === 'pct'}
              onClick={() => setDiscountMode('pct')}
              className={`min-h-[30px] min-w-[34px] rounded-lg text-xs font-bold ${discountMode === 'pct' ? 'bg-surface text-ink shadow-card' : 'text-ink-3'}`}
            >
              %
            </button>
            <button
              type="button"
              aria-pressed={discountMode === 'amt'}
              onClick={() => setDiscountMode('amt')}
              className={`min-h-[30px] min-w-[34px] rounded-lg text-xs font-bold ${discountMode === 'amt' ? 'bg-surface text-ink shadow-card' : 'text-ink-3'}`}
            >
              F
            </button>
          </span>
        </span>
        <input
          id="invoice-discount"
          inputMode="numeric"
          value={discountValue}
          onChange={(e) => setDiscountValue(e.target.value)}
          className="h-12 rounded-field border border-line-strong px-3 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="invoice-tax" className="text-[13px] font-semibold text-ink">
          {t('invoices.new.taxPercentLabel')}
        </label>
        <input
          id="invoice-tax"
          inputMode="numeric"
          value={taxPercent}
          onChange={(e) => setTaxPercent(e.target.value)}
          className="h-12 rounded-field border border-line-strong px-3 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="invoice-shipping" className="text-[13px] font-semibold text-ink">
          {t('invoices.new.shippingFeeLabel')}
        </label>
        <input
          id="invoice-shipping"
          inputMode="numeric"
          value={shippingFee}
          onChange={(e) => setShippingFee(e.target.value)}
          className="h-12 rounded-field border border-line-strong px-3 text-sm text-ink"
        />
      </div>
    </div>
  )

  const themePicker = (
    <div className="flex gap-2">
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={t('invoices.new.themeAria', { name: option.label })}
          aria-pressed={theme === option.value}
          onClick={() => setTheme(option.value)}
          className={`flex size-9 items-center justify-center rounded-full bg-surface ${theme === option.value ? 'ring-2 ring-ink' : 'ring-1 ring-line-strong'}`}
        >
          <span className={`size-6 rounded-full ${option.dot}`} />
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* --- Mobile (< 1024px) --- */}
      <div className="flex flex-col gap-4 pb-28 lg:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            aria-label={t('invoices.detail.backAria')}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <X className="size-5" />
          </Link>
          <h1 className="flex-1 text-[22px] font-bold text-ink">{t('invoices.newInvoice')}</h1>
        </div>

        {clientSelect}
        {linesTable}

        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold text-ink">{t('invoices.new.themeLabel')}</span>
          {themePicker}
        </div>

        {discountTaxShipping}

        <div className="flex flex-col gap-2">
          <label htmlFor="invoice-due-mobile" className="text-[13px] font-semibold text-ink">
            {t('invoices.new.dueDateShortLabel')}
          </label>
          <input
            id="invoice-due-mobile"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-12 rounded-field border border-line-strong px-3 text-sm text-ink"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold text-ink">{t('invoices.preview')}</span>
          {previewInvoice ? (
            <InvoicePreviewCard invoice={previewInvoice} />
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-[20px] border border-line bg-surface p-6 text-center text-sm text-subtle">
              {t('invoices.new.previewPlaceholder')}
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2.5 border-t border-line bg-surface p-5 pb-7">
          <Button variant="secondary" disabled={submitting !== null} onClick={() => handleSubmit('draft')}>
            {submitting === 'draft' ? '…' : t('invoices.new.draftButton')}
          </Button>
          <Button variant="primary" disabled={submitting !== null} onClick={() => handleSubmit('unpaid')}>
            {submitting === 'send' ? '…' : t('invoices.detail.sendButton')}
          </Button>
        </div>
      </div>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-1.5">
            <nav aria-label={t('products.breadcrumbAria')} className="flex gap-2 text-[13px] text-subtle">
              <Link href="/invoices" className="font-semibold">
                {t('invoices.title')}
              </Link>
              <span aria-hidden>/</span>
              <span>{t('invoices.newInvoice')}</span>
            </nav>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('invoices.newInvoice')}</h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="glass" disabled={submitting !== null} onClick={() => handleSubmit('draft')}>
              {submitting === 'draft' ? t('invoices.new.savingDraft') : t('invoices.new.saveDraftButton')}
            </Button>
            <Button variant="primary" disabled={submitting !== null} onClick={() => handleSubmit('unpaid')}>
              {submitting === 'send' ? t('invoices.new.sendingInvoice') : t('invoices.new.sendInvoiceButton')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex flex-[3_1_520px] flex-col gap-5 rounded-panel p-[22px]">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {clientSelect}
              <div className="flex flex-col gap-2">
                <label htmlFor="invoice-issued" className="text-[13px] font-semibold text-ink">
                  {t('invoices.new.issuedDateLabel')}
                </label>
                <input
                  id="invoice-issued"
                  type="date"
                  value={dayjs().format('YYYY-MM-DD')}
                  disabled
                  className="h-12 rounded-field border border-line-strong bg-surface-soft px-3 text-sm text-ink-3"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="invoice-due" className="text-[13px] font-semibold text-ink">
                  {t('invoices.new.dueDateShortLabel')}
                </label>
                <input
                  id="invoice-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-12 rounded-field border border-line-strong px-3 text-sm text-ink"
                />
              </div>
            </div>

            {linesTable}
            {discountTaxShipping}

            <div className="flex flex-col gap-2">
              <label htmlFor="invoice-notes" className="text-[13px] font-semibold text-ink">
                {t('invoices.new.notesForClientLabel')}
              </label>
              <textarea
                id="invoice-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-field border border-line-strong px-3.5 py-3 text-sm text-ink"
              />
            </div>
          </Card>

          <aside
            aria-label={t('invoices.preview')}
            className="glass-panel flex flex-[2_1_380px] flex-col gap-3.5 rounded-panel p-[18px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">{t('invoices.preview')}</h2>
              {themePicker}
            </div>
            {previewInvoice ? (
              <InvoicePreviewCard invoice={previewInvoice} />
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-[20px] bg-surface p-6 text-center text-sm text-subtle">
                {t('invoices.new.previewPlaceholder')}
              </div>
            )}
          </aside>
        </div>
      </div>

      <ClientFormDialog
        open={clientDialogOpen}
        showInvoiceAction={false}
        onClose={() => setClientDialogOpen(false)}
        onSuccess={(client) => {
          setClients((prev) => [...prev, client])
          setClientId(client.id)
          setClientDialogOpen(false)
        }}
      />
    </div>
  )
}
