'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { toast } from 'sonner'
import { Plus, Search, X } from 'lucide-react'

import { getArticles, type Article } from '@/lib/services/articles'
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
import { Button, Card } from '@/components/waelly'

dayjs.locale('fr')

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const THEME_OPTIONS: { value: InvoiceTheme; label: string; dot: string }[] = [
  { value: 'modern', label: 'Moderne', dot: 'bg-[#1d4ed8]' },
  { value: 'classic', label: 'Classique', dot: 'bg-[#1a1a1a]' },
  { value: 'professional', label: 'Professionnel', dot: 'bg-[#1c2431]' },
  { value: 'minimal', label: 'Minimaliste', dot: 'bg-[#DADADF]' },
]

interface InvoiceLine {
  id: string
  article: Article
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
 * - Les variations d'un article variable ne sont pas sélectionnables dans
 *   une ligne de facture : l'API de création de facture n'accepte qu'un
 *   article_id, jamais un variable_id.
 * - L'avertissement de stock insuffisant est indicatif (pas un blocage) :
 *   le stock n'est décrémenté par l'API qu'au passage au statut "payée",
 *   jamais à la création d'une facture brouillon/envoyée.
 */
export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const [discountMode, setDiscountMode] = React.useState<'pct' | 'amt'>('pct')
  const [discountValue, setDiscountValue] = React.useState('0')
  const [taxPercent, setTaxPercent] = React.useState('0')
  const [shippingFee, setShippingFee] = React.useState('0')
  const [notes, setNotes] = React.useState('Merci pour votre confiance.')
  const [dueDate, setDueDate] = React.useState(dayjs().add(15, 'day').format('YYYY-MM-DD'))
  const [theme, setTheme] = React.useState<InvoiceTheme>('modern')

  const [companyName, setCompanyName] = React.useState('')
  const [companyCity, setCompanyCity] = React.useState<string | null>(null)

  const [submitting, setSubmitting] = React.useState<'draft' | 'send' | null>(null)
  const submittingRef = React.useRef(false)

  React.useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => toast.error('Erreur lors du chargement des clients'))
      .finally(() => setLoadingClients(false))

    getArticles()
      .then(setArticles)
      .catch(() => toast.error('Erreur lors du chargement des articles'))
      .finally(() => setLoadingArticles(false))

    checkCompanyProfile()
      .then(({ company }) => {
        setCompanyName(company?.name ?? '')
        setCompanyCity(company?.headquarters ?? null)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (preselectClientId) setClientId(preselectClientId)
  }, [preselectClientId])

  const selectedClient = clients.find((c) => c.id === clientId) ?? null

  const filteredArticles = React.useMemo(
    () => articles.filter((a) => a.name.toLowerCase().includes(articleSearch.trim().toLowerCase())),
    [articles, articleSearch]
  )

  const addLine = (article: Article) => {
    setLines((prev) => [
      ...prev,
      { id: `${article.id}-${Date.now()}`, article, quantity: 1, unitPrice: article.sale_price },
    ])
    setPickerOpen(false)
    setArticleSearch('')
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
        invoice_number: 'Aperçu',
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
        formatted_total: `${formatAmount(total)} F`,
        client: selectedClient,
        company: { id: '', name: companyName, email: '', logo_url: null, headquarters: companyCity },
        items: lines.map((l) => ({
          id: l.id,
          invoice_id: '',
          article_id: String(l.article.id),
          name_snapshot: l.article.name,
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
      toast.error('Sélectionnez un client')
      return
    }
    if (lines.length === 0) {
      toast.error('Ajoutez au moins une ligne')
      return
    }

    submittingRef.current = true
    setSubmitting(status === 'draft' ? 'draft' : 'send')
    try {
      const payload: CreateInvoicePayload = {
        client_id: clientId,
        items: lines.map((l) => ({
          article_id: String(l.article.id),
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
      toast.success(status === 'draft' ? 'Brouillon enregistré' : 'Facture envoyée')
      router.push(`/invoices/${invoice.id}`)
    } catch (err: unknown) {
      const error = err as { status?: number; errors?: unknown; message?: string }
      if (error.status === 422 && Array.isArray(error.errors) && error.errors.length > 0) {
        error.errors.forEach((m) => toast.error(String(m)))
      } else if (error.status === 422 && error.errors && typeof error.errors === 'object') {
        const first = Object.values(error.errors as Record<string, string[]>)[0]
        toast.error(Array.isArray(first) ? first[0] : error.message || "Échec de l'enregistrement")
      } else {
        toast.error(error.message || "Échec de l'enregistrement")
      }
    } finally {
      submittingRef.current = false
      setSubmitting(null)
    }
  }

  const articlePicker = (
    <div className="flex flex-col gap-2 rounded-tile border border-line bg-surface-soft p-3">
      <div className="relative flex">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-subtle" />
        <input
          autoFocus
          value={articleSearch}
          onChange={(e) => setArticleSearch(e.target.value)}
          placeholder="Rechercher un article"
          className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none"
        />
      </div>
      <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto">
        {loadingArticles ? (
          <p className="py-3 text-center text-sm text-subtle">Chargement…</p>
        ) : filteredArticles.length === 0 ? (
          <p className="py-3 text-center text-sm text-subtle">Aucun article</p>
        ) : (
          filteredArticles.map((article) => (
            <button
              key={article.id}
              type="button"
              onClick={() => addLine(article)}
              className="flex items-center justify-between gap-2.5 rounded-tile px-2.5 py-2 text-left hover:bg-surface"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{article.name}</span>
                <span className="text-xs text-subtle">{article.remaining_quantity} en stock</span>
              </span>
              <span className="shrink-0 text-sm font-bold text-ink">{formatAmount(article.sale_price)} F</span>
            </button>
          ))
        )}
      </div>
    </div>
  )

  const linesTable = (
    <div className="flex flex-col gap-2.5">
      <span className="text-[13px] font-semibold text-ink">Lignes</span>
      {lines.length > 0 ? (
        <div className="overflow-x-auto rounded-tile border border-line">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface-soft text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                <th className="px-3 py-2.5">Désignation</th>
                <th className="px-3 py-2.5">Qté</th>
                <th className="px-3 py-2.5">Prix unit.</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const stockWarning = line.quantity > line.article.remaining_quantity
                return (
                  <tr key={line.id} className="border-t border-divider align-top">
                    <td className="px-3 py-2.5">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold text-ink">{line.article.name}</span>
                        <span className="text-xs text-subtle">
                          Depuis le stock
                          {stockWarning ? (
                            <span className="ml-1 font-semibold text-danger-strong">
                              · stock disponible : {line.article.remaining_quantity}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuer"
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
                          aria-label="Augmenter"
                          onClick={() => updateLineQuantity(line.id, line.quantity + 1)}
                          className="flex size-8 items-center justify-center rounded-full border border-line-strong bg-surface font-bold text-ink"
                        >
                          +
                        </button>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatAmount(line.unitPrice)} F</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-ink">
                      {formatAmount(line.quantity * line.unitPrice)} F
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label="Supprimer la ligne"
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
          Depuis le stock
        </button>
      )}
    </div>
  )

  const clientSelect = (
    <div className="flex flex-col gap-2">
      <label htmlFor="invoice-client" className="text-[13px] font-semibold text-ink">
        Client
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
        <option value="">{loadingClients ? 'Chargement…' : 'Choisir un client'}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value="__new__">+ Nouveau client…</option>
      </select>
    </div>
  )

  const discountTaxShipping = (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <span className="flex items-center justify-between">
          <label htmlFor="invoice-discount" className="text-[13px] font-semibold text-ink">
            Remise
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
          Taxe (%)
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
          Frais de port (F)
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
      {THEME_OPTIONS.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-label={`Thème ${t.label}`}
          aria-pressed={theme === t.value}
          onClick={() => setTheme(t.value)}
          className={`flex size-9 items-center justify-center rounded-full bg-surface ${theme === t.value ? 'ring-2 ring-ink' : 'ring-1 ring-line-strong'}`}
        >
          <span className={`size-6 rounded-full ${t.dot}`} />
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
            aria-label="Retour aux factures"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <X className="size-5" />
          </Link>
          <h1 className="flex-1 text-[22px] font-bold text-ink">Nouvelle facture</h1>
        </div>

        {clientSelect}
        {linesTable}

        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-semibold text-ink">Thème de la facture</span>
          {themePicker}
        </div>

        {discountTaxShipping}

        <div className="flex flex-col gap-2">
          <label htmlFor="invoice-due-mobile" className="text-[13px] font-semibold text-ink">
            Échéance
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
          <span className="text-[13px] font-semibold text-ink">Aperçu</span>
          {previewInvoice ? (
            <InvoicePreviewCard invoice={previewInvoice} />
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-[20px] border border-line bg-surface p-6 text-center text-sm text-subtle">
              Choisissez un client pour voir l&apos;aperçu.
            </div>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2.5 border-t border-line bg-surface p-5 pb-7">
          <Button variant="secondary" disabled={submitting !== null} onClick={() => handleSubmit('draft')}>
            {submitting === 'draft' ? '…' : 'Brouillon'}
          </Button>
          <Button variant="primary" disabled={submitting !== null} onClick={() => handleSubmit('unpaid')}>
            {submitting === 'send' ? '…' : 'Envoyer'}
          </Button>
        </div>
      </div>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-1.5">
            <nav aria-label="Fil d'Ariane" className="flex gap-2 text-[13px] text-subtle">
              <Link href="/invoices" className="font-semibold">
                Factures
              </Link>
              <span aria-hidden>/</span>
              <span>Nouvelle facture</span>
            </nav>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">Nouvelle facture</h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="glass" disabled={submitting !== null} onClick={() => handleSubmit('draft')}>
              {submitting === 'draft' ? 'Enregistrement…' : 'Enregistrer le brouillon'}
            </Button>
            <Button variant="primary" disabled={submitting !== null} onClick={() => handleSubmit('unpaid')}>
              {submitting === 'send' ? 'Envoi…' : 'Envoyer la facture'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex flex-[3_1_520px] flex-col gap-5 rounded-panel p-[22px]">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              {clientSelect}
              <div className="flex flex-col gap-2">
                <label htmlFor="invoice-issued" className="text-[13px] font-semibold text-ink">
                  Date d&apos;émission
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
                  Échéance
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
                Note pour le client
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
            aria-label="Aperçu"
            className="glass-panel flex flex-[2_1_380px] flex-col gap-3.5 rounded-panel p-[18px]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Aperçu</h2>
              {themePicker}
            </div>
            {previewInvoice ? (
              <InvoicePreviewCard invoice={previewInvoice} />
            ) : (
              <div className="flex h-[360px] items-center justify-center rounded-[20px] bg-surface p-6 text-center text-sm text-subtle">
                Choisissez un client pour voir l&apos;aperçu.
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
