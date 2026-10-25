'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Image as ImageIcon, Minus, Plus, X } from 'lucide-react'

import { addArticle } from '@/lib/services/articles'
import { invalidateArticles, invalidateUserStats } from '@/lib/hooks/useCache'
import { useCurrency } from '@/lib/utils/currency'
import { useSettings } from '@/contexts/SettingsContext'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { Button, Card, SegmentedControl } from '@/components/waelly'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const initials = (name: string): string => (name.trim() ? name.trim().slice(0, 2).toUpperCase() : 'NA')

function buildTypeOptions(t: ReturnType<typeof useTranslation>['t']) {
  return [
    { value: 'simple', label: t('products.typeSimple') },
    { value: 'variable', label: t('products.typeVariableOption') },
  ]
}

function buildNewArticleSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z
    .object({
      name: z.string().min(2, t('products.new.validationNameMin')),
      type: z.enum(['simple', 'variable']),
      // Article simple uniquement.
      sale_price: z.string(),
      quantity: z.string(),
      // Article variable uniquement : pré-remplit le prix des NOUVELLES lignes,
      // n'est jamais envoyé à l'API (un article variable n'a pas de prix propre).
      default_price: z.string(),
      variations: z.array(
        z.object({
          name: z.string().min(1, t('products.new.validationVariationNameRequired')),
          quantity: z.string(),
          price: z.string(),
        })
      ),
    })
    .superRefine((data, ctx) => {
      if (data.type === 'simple') {
        const price = parseFloat(data.sale_price)
        if (data.sale_price.trim() === '' || Number.isNaN(price) || price <= 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sale_price'], message: t('products.new.validationPricePositive') })
        }
        const q = parseInt(data.quantity, 10)
        if (data.quantity.trim() === '' || Number.isNaN(q) || q < 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: t('products.new.validationQuantityPositive') })
        }
        return
      }

      if (data.variations.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variations'], message: t('products.new.validationAtLeastOneVariation') })
      }

      const seenNames = new Map<string, number>()
      data.variations.forEach((variation, index) => {
        const normalized = variation.name.trim().toLowerCase()
        if (normalized) {
          if (seenNames.has(normalized)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['variations', index, 'name'],
              message: t('products.new.validationDuplicateVariationName'),
            })
          } else {
            seenNames.set(normalized, index)
          }
        }

        const q = parseInt(variation.quantity, 10)
        if (variation.quantity.trim() === '' || Number.isNaN(q) || q < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['variations', index, 'quantity'],
            message: t('products.new.validationInvalidQuantity'),
          })
        }

        const p = parseFloat(variation.price)
        if (variation.price.trim() === '' || Number.isNaN(p) || p <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['variations', index, 'price'],
            message: t('products.new.validationPricePositive'),
          })
        }
      })
    })
}

type NewArticleFormValues = z.infer<ReturnType<typeof buildNewArticleSchema>>

/**
 * Ajouter un article — reprend design/maquettes/ordinateur/Web-AjoutArticle.dc.html
 * (≥ 1024px) et design/maquettes/mobile/AjoutArticle.dc.html (< 768px).
 *
 * Écarts assumés (données/fonctionnalités réellement indisponibles, aucune
 * invention) :
 * - "Catégorie" n'existe pas sur le modèle Article (ni colonne, ni
 *   validation côté API) : le select est entièrement masqué, comme demandé.
 * - Aucun endpoint d'upload d'image n'existe (ni pour l'article, ni pour une
 *   variation) : les zones photo restent cliquables/glissables et affichent
 *   un aperçu local (URL objet navigateur), mais rien n'est envoyé au
 *   serveur — un toast le signale au premier choix de fichier.
 * - Le "seuil d'alerte" n'est pas un champ par article (réglage global,
 *   user_settings.low_stock_threshold) : affiché en lecture seule avec un
 *   lien vers /settings, sans stepper, comme demandé.
 * - Un article variable n'a ni quantité ni prix propres : chaque variation
 *   porte les siens. Une seule requête POST /api/articles avec variations[]
 *   crée l'article et toutes ses variations de façon atomique.
 */
export default function NewArticlePage() {
  const router = useRouter()
  const { currency } = useCurrency()
  const { settings } = useSettings()
  const { t, language } = useTranslation()
  const typeOptions = React.useMemo(() => buildTypeOptions(t), [t])

  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const [quickAddValue, setQuickAddValue] = React.useState('')
  const photoWarnedRef = React.useRef(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const newArticleSchema = React.useMemo(() => buildNewArticleSchema(t), [t])
  const {
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewArticleFormValues>({
    resolver: zodResolver(newArticleSchema),
    defaultValues: {
      name: '',
      type: 'simple',
      sale_price: '',
      quantity: '0',
      default_price: '',
      variations: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variations' })

  const name = watch('name')
  const salePriceStr = watch('sale_price')
  const type = watch('type')
  const quantityStr = watch('quantity')
  const defaultPriceStr = watch('default_price')
  const variationsWatch = watch('variations')

  const priceNum = parseFloat(salePriceStr) || 0
  const qtySimple = parseInt(quantityStr || '0', 10) || 0

  const variationPrices = variationsWatch.map((v) => parseFloat(v.price)).filter((p) => !Number.isNaN(p) && p > 0)
  const priceMin = variationPrices.length > 0 ? Math.min(...variationPrices) : 0
  const priceMax = variationPrices.length > 0 ? Math.max(...variationPrices) : 0

  const total =
    type === 'variable'
      ? variationsWatch.reduce((sum, v) => sum + (parseInt(v.quantity || '0', 10) || 0), 0)
      : qtySimple
  const stockValue =
    type === 'variable'
      ? variationsWatch.reduce((sum, v) => {
          const q = parseInt(v.quantity || '0', 10) || 0
          const p = parseFloat(v.price) || 0
          return sum + q * p
        }, 0)
      : total * priceNum
  const lowStockThreshold = settings?.low_stock_threshold ?? 80

  const priceRangeLabel =
    variationPrices.length === 0
      ? '—'
      : priceMin === priceMax
        ? `${formatAmount(priceMin, language)} F`
        : `${formatAmount(priceMin, language)} – ${formatAmount(priceMax, language)} F`

  const warnPhotoUnavailable = () => {
    if (!photoWarnedRef.current) {
      toast(t('products.new.photoNotAvailable'))
      photoWarnedRef.current = true
    }
  }

  const handlePhotoFile = (file: File | null | undefined) => {
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    warnPhotoUnavailable()
  }

  const handlePhotoDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    handlePhotoFile(e.dataTransfer.files?.[0])
  }

  const handleTypeChange = (next: string) => {
    setValue('type', next as 'simple' | 'variable')
    if (next === 'variable' && fields.length === 0) {
      append({ name: '', quantity: '0', price: defaultPriceStr || '' })
    }
  }

  const addVariationRow = () => {
    append({ name: '', quantity: '0', price: defaultPriceStr || '' })
  }

  // "Créer plusieurs variations d'un coup" : taper "S, M, L, XL" puis Entrée
  // crée 4 lignes, chacune pré-remplie avec le prix par défaut.
  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const names = quickAddValue
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    if (names.length === 0) return
    names.forEach((n) => append({ name: n, quantity: '0', price: defaultPriceStr || '' }))
    setQuickAddValue('')
  }

  const onSubmit = async (data: NewArticleFormValues) => {
    try {
      if (data.type === 'simple') {
        const qty = parseInt(data.quantity, 10) || 0
        const article = await addArticle({
          name: data.name.trim(),
          type: 'simple',
          sale_price: parseFloat(data.sale_price),
          quantity: qty,
          image: null,
        })
        toast.success(t('products.new.toastArticleAdded'))
        await Promise.all([invalidateArticles(), invalidateUserStats()])
        router.push(`/products/${article.id}`)
        return
      }

      // Création atomique : une seule requête, l'article et ses variations
      // sont créés ensemble côté backend (DB::transaction) — si une
      // variation échoue (ex. doublon détecté en base), rien n'est créé.
      const article = await addArticle({
        name: data.name.trim(),
        type: 'variable',
        variations: data.variations.map((v) => ({
          name: v.name.trim(),
          quantity: parseInt(v.quantity, 10) || 0,
          price: parseFloat(v.price),
        })),
        image: null,
      })

      toast.success(t('products.new.toastArticleAdded'))
      await Promise.all([invalidateArticles(), invalidateUserStats()])
      router.push(`/products/${article.id}`)
    } catch (err: unknown) {
      toast.error((err as Error).message || t('products.new.errorAddFailed'))
    }
  }

  const photoButton = (sizeClass: string, helpText: string) => (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      onDrop={handlePhotoDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-tile border-[1.5px] border-dashed border-brand-200 bg-brand-50 text-center text-brand-700 ${sizeClass}`}
    >
      {photoPreview ? (
        <>
          <Image src={photoPreview} alt="" fill className="object-cover" unoptimized />
          <span className="absolute bottom-2 rounded-full bg-surface px-3 py-1 text-xs font-bold text-brand-700">
            {t('products.new.changePhoto')}
          </span>
        </>
      ) : (
        <>
          <span className="flex size-12 items-center justify-center rounded-full bg-surface">
            <ImageIcon className="size-6" strokeWidth={1.8} />
          </span>
          <span className="text-sm font-bold">{t('products.new.addPhoto')}</span>
          <span className="px-2 text-xs text-ink-3">{helpText}</span>
        </>
      )}
    </button>
  )

  const previewCard = (
    <div className="flex flex-col gap-3 rounded-tile bg-surface p-3 shadow-card">
      {photoPreview ? (
        <span className="relative block h-[150px] overflow-hidden rounded-tile">
          <Image src={photoPreview} alt="" fill className="object-cover" unoptimized />
        </span>
      ) : (
        <span className="flex h-[150px] items-center justify-center rounded-tile bg-gradient-to-br from-brand-100 to-brand-200 text-2xl font-extrabold text-brand-700">
          {initials(name)}
        </span>
      )}
      <span className="flex items-baseline justify-between gap-2 px-1">
        <span className="truncate text-[15px] font-bold text-ink">{name.trim() || t('products.new.articleNamePlaceholder')}</span>
        <span className="shrink-0 text-[15px] font-extrabold text-ink">
          {type === 'variable' ? priceRangeLabel : `${formatAmount(priceNum, language)} F`}
        </span>
      </span>
      <span className="px-1 text-[13px] text-subtle">
        {type === 'variable' ? t('products.new.variationCount', { count: fields.length }) : t('products.typeSimple')}
      </span>
      {type === 'variable' && fields.length > 0 ? (
        <span className="flex flex-wrap gap-1.5 px-1">
          {fields.map((f, i) => (
            <span key={f.id} className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-bold text-ink-2">
              {variationsWatch[i]?.name?.trim() || t('products.new.previewVariationFallback', { index: i + 1 })} ·{' '}
              {parseInt(variationsWatch[i]?.quantity || '0', 10) || 0}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  )

  const stockTiles = (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="flex flex-col gap-1 rounded-tile bg-hero p-3.5 text-white">
        <span className="text-xs text-navy-text">{t('products.new.stockTotalLabel')}</span>
        <span className="text-lg font-extrabold">
          {t('products.new.piecesCount', { count: total })}
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-tile bg-surface p-3.5 shadow-card">
        <span className="text-xs text-subtle">{t('products.new.valueLabel')}</span>
        <span className="text-lg font-extrabold text-ink">{formatAmount(stockValue, language)} F</span>
      </div>
      {type === 'variable' ? (
        <div className="col-span-2 flex items-center justify-between rounded-tile border border-line bg-surface p-3.5">
          <span className="text-xs text-subtle">{t('products.new.priceLabel')}</span>
          <span className="text-sm font-extrabold text-ink">{priceRangeLabel}</span>
        </div>
      ) : null}
    </div>
  )

  const lowStockRow = (
    <div className="flex items-center justify-between gap-3 border-t border-divider pt-3.5">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">{t('products.new.lowStockAlert')}</span>
        <span className="text-[13px] text-subtle">{t('products.new.globalThresholdOfSales', { threshold: lowStockThreshold })}</span>
      </span>
      <Link href="/settings#low-stock-threshold" className="shrink-0 text-[13px] font-bold text-brand-700">
        {t('products.new.editInSettings')}
      </Link>
    </div>
  )

  const quickAddRow = (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="quick-add-variations" className="text-xs font-semibold text-ink-2">
        {t('products.new.quickAddLabel')}
      </label>
      <input
        id="quick-add-variations"
        value={quickAddValue}
        onChange={(e) => setQuickAddValue(e.target.value)}
        onKeyDown={handleQuickAddKeyDown}
        placeholder={t('products.new.quickAddPlaceholder')}
        className="h-11 rounded-field border border-dashed border-brand-300 bg-brand-50 px-3.5 text-sm text-ink placeholder:text-ink-3"
      />
    </div>
  )

  const defaultPriceField = (
    <div className="flex flex-col gap-2">
      <label htmlFor="default-price" className="text-[13px] font-semibold text-ink">
        {t('products.new.defaultPriceLabel', { currency })} <span className="font-normal text-subtle">{t('products.new.optionalHint')}</span>
      </label>
      <Controller
        control={control}
        name="default_price"
        render={({ field }) => (
          <input
            id="default-price"
            inputMode="numeric"
            placeholder={t('products.new.defaultPricePlaceholder')}
            {...field}
            className="h-11 rounded-field border border-line-strong px-3.5 text-sm text-ink placeholder:text-ink-3"
          />
        )}
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handlePhotoFile(e.target.files?.[0])}
      />

      {/* --- Mobile (< 1024px) --- */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 pb-32 lg:hidden">
        <div className="-mx-4 -mt-5 flex items-center gap-3 bg-canvas px-4 pb-3 pt-[52px]">
          <Link
            href="/products"
            aria-label={t('products.detail.backToStock')}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <ArrowLeft className="size-[22px]" />
          </Link>
          <h1 className="flex-1 text-[22px] font-bold tracking-tight text-ink">{t('products.new.mobileHeaderTitle')}</h1>
          <Link href="/products" className="px-0 py-3 text-sm font-semibold text-ink-3">
            {t('products.cancel')}
          </Link>
        </div>

        {photoButton('h-[150px] w-full', t('products.new.photoHelpMobile'))}

        <div className="flex flex-col gap-2">
          <label htmlFor="m-article-name" className="text-[13px] font-semibold text-ink">
            {t('products.new.articleNameLabel')}
          </label>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <input
                id="m-article-name"
                placeholder={t('products.new.articleNamePlaceholderInput')}
                {...field}
                className="h-[52px] rounded-field border border-line-strong px-4 text-base text-ink"
              />
            )}
          />
          {errors.name ? <p className="text-xs text-danger-strong">{errors.name.message}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink">{t('products.detail.articleType')}</span>
          <SegmentedControl
            options={typeOptions}
            value={type}
            onChange={handleTypeChange}
            className="border-transparent bg-surface-soft p-1"
          />
          <span className="text-xs text-subtle">
            {type === 'variable'
              ? t('products.new.typeHelperVariableMobile')
              : t('products.new.typeHelperSimpleMobile')}
          </span>
        </div>

        {type === 'simple' ? (
          <>
            <div className="flex flex-col gap-2">
              <label htmlFor="m-article-price" className="text-[13px] font-semibold text-ink">
                {t('products.detail.salePriceLabel', { currency })}
              </label>
              <Controller
                control={control}
                name="sale_price"
                render={({ field }) => (
                  <input
                    id="m-article-price"
                    inputMode="numeric"
                    {...field}
                    className="h-[52px] rounded-field border border-line-strong px-3.5 text-base text-ink"
                  />
                )}
              />
              {errors.sale_price ? <p className="text-xs text-danger-strong">{errors.sale_price.message}</p> : null}
            </div>

            <div className="flex items-center justify-between gap-3 rounded-tile border border-line bg-surface p-3.5">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{t('products.new.quantityInStockLabel')}</span>
                <span className="text-xs text-subtle">{t('products.new.startingQuantity')}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={t('products.decrease')}
                  onClick={() => setValue('quantity', String(Math.max(0, qtySimple - 1)))}
                  className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-canvas text-lg font-bold text-ink"
                >
                  <Minus className="size-4" />
                </button>
                <Controller
                  control={control}
                  name="quantity"
                  render={({ field }) => (
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      aria-label={t('products.new.quantityInStockAria')}
                      {...field}
                      className="w-10 rounded-lg border border-line-strong bg-surface text-center text-lg font-extrabold text-ink outline-none focus:border-brand-500"
                    />
                  )}
                />
                <button
                  type="button"
                  aria-label={t('products.increase')}
                  onClick={() => setValue('quantity', String(qtySimple + 1))}
                  className="flex size-11 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white"
                >
                  <Plus className="size-4" />
                </button>
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2.5">
            {defaultPriceField}
            {quickAddRow}
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-ink">{t('products.new.variationsLabel')}</span>
              <span className="text-xs text-subtle">
                {t('products.new.variationsSummaryMobile', { count: fields.length, total, priceRange: priceRangeLabel })}
              </span>
            </div>
            {errors.variations?.root || (errors.variations && !Array.isArray(errors.variations)) ? (
              <p className="text-xs text-danger-strong">
                {(errors.variations as unknown as { message?: string })?.message}
              </p>
            ) : null}
            {fields.map((field, index) => {
              const q = parseInt(variationsWatch[index]?.quantity || '0', 10) || 0
              return (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-tile border border-line bg-surface p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      aria-label={t('products.new.variationPhotoAria', { index: index + 1 })}
                      onClick={warnPhotoUnavailable}
                      className="flex size-11 shrink-0 items-center justify-center rounded-tile border border-dashed border-brand-200 bg-brand-50 text-brand-500"
                    >
                      <Plus className="size-[18px]" strokeWidth={1.9} />
                    </button>
                    <Controller
                      control={control}
                      name={`variations.${index}.name`}
                      render={({ field }) => (
                        <input
                          aria-label={t('products.new.variationNameAria')}
                          placeholder={t('products.detail.variationNamePlaceholder')}
                          {...field}
                          className="h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong px-2.5 text-[15px] text-ink"
                        />
                      )}
                    />
                    <button
                      type="button"
                      aria-label={t('products.new.removeVariationAria')}
                      onClick={() => remove(index)}
                      className="flex size-11 shrink-0 items-center justify-center text-danger-strong"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2.5 pl-[50px]">
                    <span className="flex items-center">
                      <button
                        type="button"
                        aria-label={t('products.decrease')}
                        onClick={() => setValue(`variations.${index}.quantity`, String(Math.max(0, q - 1)))}
                        className="flex h-11 w-[34px] items-center justify-center text-lg font-bold text-ink-3"
                      >
                        −
                      </button>
                      <Controller
                        control={control}
                        name={`variations.${index}.quantity`}
                        render={({ field }) => (
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={t('products.new.variationQuantityAria')}
                            {...field}
                            className="h-9 w-12 rounded-lg border border-line-strong text-center text-sm font-bold text-ink outline-none focus:border-brand-500"
                          />
                        )}
                      />
                      <button
                        type="button"
                        aria-label={t('products.increase')}
                        onClick={() => setValue(`variations.${index}.quantity`, String(q + 1))}
                        className="flex h-11 w-[34px] items-center justify-center text-lg font-bold text-brand-500"
                      >
                        +
                      </button>
                    </span>
                    <Controller
                      control={control}
                      name={`variations.${index}.price`}
                      render={({ field }) => (
                        <input
                          inputMode="numeric"
                          aria-label={t('products.new.variationPriceAria')}
                          placeholder={t('products.new.variationPricePlaceholder', { currency })}
                          {...field}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong px-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-500"
                        />
                      )}
                    />
                  </div>
                  {errors.variations?.[index]?.name ? (
                    <p className="pl-[50px] text-xs text-danger-strong">{errors.variations[index]?.name?.message}</p>
                  ) : null}
                  {errors.variations?.[index]?.price ? (
                    <p className="pl-[50px] text-xs text-danger-strong">{errors.variations[index]?.price?.message}</p>
                  ) : null}
                </div>
              )
            })}
            <button
              type="button"
              onClick={addVariationRow}
              className="flex min-h-12 items-center justify-center rounded-full border border-dashed border-brand-300 text-sm font-bold text-brand-700"
            >
              {t('products.new.addVariationButton')}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-tile border border-line bg-surface p-3.5">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">{t('products.new.lowStockAlert')}</span>
            <span className="text-xs text-subtle">{t('products.new.globalThreshold', { threshold: lowStockThreshold })}</span>
          </span>
          <Link href="/settings#low-stock-threshold" className="shrink-0 text-[13px] font-bold text-brand-700">
            {t('products.detail.modify')}
          </Link>
        </div>

        <div className="glass fixed inset-x-3.5 bottom-[22px] z-30 flex items-center gap-3 rounded-[32px] p-2 pl-5">
          <span className="flex flex-1 flex-col gap-px">
            <span className="text-xs text-ink-3">{t('products.new.stockTotalLabel')}</span>
            <span className="text-base font-extrabold text-ink">
              {t('products.new.piecesCount', { count: total })}
            </span>
          </span>
          <Button type="submit" variant="primary" className="h-[52px] rounded-full px-6" disabled={isSubmitting}>
            {isSubmitting ? t('products.saving') : t('products.save')}
          </Button>
        </div>
      </form>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <form onSubmit={handleSubmit(onSubmit)} className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-1.5">
            <nav aria-label={t('products.breadcrumbAria')} className="flex gap-2 text-[13px] text-subtle">
              <Link href="/products" className="font-semibold">
                {t('products.stockBreadcrumb')}
              </Link>
              <span aria-hidden>/</span>
              <span>{t('products.new.mobileHeaderTitle')}</span>
            </nav>
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('products.list.addArticle')}</h1>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="glass" asChild>
              <Link href="/products">{t('products.cancel')}</Link>
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? t('products.saving') : t('products.new.saveArticle')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-[3_1_520px] flex-col gap-5">
            <Card className="flex flex-col gap-4.5 rounded-panel p-6">
              <h2 className="text-lg font-bold text-ink">{t('products.new.informationsTitle')}</h2>
              <div className="flex flex-wrap items-stretch gap-4.5">
                {photoButton('min-h-[180px] flex-[0_0_180px] p-3', t('products.new.photoHelpDesktop'))}
                <div className="flex min-w-[280px] flex-1 flex-col gap-3.5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="article-name" className="text-[13px] font-semibold text-ink">
                      {t('products.new.articleNameLabel')}
                    </label>
                    <Controller
                      control={control}
                      name="name"
                      render={({ field }) => (
                        <input
                          id="article-name"
                          {...field}
                          className="h-[50px] rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
                        />
                      )}
                    />
                    {errors.name ? <p className="text-xs text-danger-strong">{errors.name.message}</p> : null}
                  </div>
                  {type === 'simple' ? (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="article-price" className="text-[13px] font-semibold text-ink">
                        {t('products.detail.salePriceLabel', { currency })}
                      </label>
                      <Controller
                        control={control}
                        name="sale_price"
                        render={({ field }) => (
                          <input
                            id="article-price"
                            inputMode="numeric"
                            {...field}
                            className="h-[50px] max-w-[260px] rounded-field border border-line-strong px-3.5 text-[15px] text-ink"
                          />
                        )}
                      />
                      {errors.sale_price ? (
                        <p className="text-xs text-danger-strong">{errors.sale_price.message}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="max-w-[320px]">{defaultPriceField}</div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-4 rounded-panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-lg font-bold text-ink">{t('products.new.stockSectionTitle')}</h2>
                  <span className="text-[13px] text-subtle">
                    {type === 'variable'
                      ? t('products.new.typeHelperVariableDesktop')
                      : t('products.new.typeHelperSimpleDesktop')}
                  </span>
                </div>
                <SegmentedControl
                  options={typeOptions}
                  value={type}
                  onChange={handleTypeChange}
                  className="border-transparent bg-canvas p-1"
                />
              </div>

              {type === 'simple' ? (
                <div className="flex items-center justify-between gap-3 rounded-tile bg-surface-soft p-3.5">
                  <span className="text-sm font-semibold text-ink">{t('products.new.initialQuantityLabel')}</span>
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={t('products.decrease')}
                      onClick={() => setValue('quantity', String(Math.max(0, qtySimple - 1)))}
                      className="flex size-[42px] items-center justify-center rounded-full border border-line-strong bg-surface text-lg font-bold text-ink"
                    >
                      <Minus className="size-4" />
                    </button>
                    <Controller
                      control={control}
                      name="quantity"
                      render={({ field }) => (
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          aria-label={t('products.new.initialQuantityLabel')}
                          {...field}
                          className="w-12 rounded-lg border border-line-strong bg-surface text-center text-lg font-extrabold text-ink outline-none focus:border-brand-500"
                        />
                      )}
                    />
                    <button
                      type="button"
                      aria-label={t('products.increase')}
                      onClick={() => setValue('quantity', String(qtySimple + 1))}
                      className="flex size-[42px] items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white"
                    >
                      <Plus className="size-4" />
                    </button>
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="max-w-[420px]">{quickAddRow}</div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold text-ink">
                      {t('products.new.variationCount', { count: fields.length })}
                    </span>
                    <span className="text-xs text-subtle">
                      {t('products.new.variationsSummaryDesktop', { total, priceRange: priceRangeLabel })}
                    </span>
                  </div>
                  {errors.variations?.root || (errors.variations && !Array.isArray(errors.variations)) ? (
                    <p className="text-xs text-danger-strong">
                      {(errors.variations as unknown as { message?: string })?.message}
                    </p>
                  ) : null}
                  <div className="overflow-x-auto rounded-tile border border-line">
                    <table className="w-full min-w-[560px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-surface-soft text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                          <th className="px-3 py-2.5">{t('products.colPhoto')}</th>
                          <th className="px-3 py-2.5">{t('products.colVariation')}</th>
                          <th className="px-3 py-2.5">{t('products.colQuantity')}</th>
                          <th className="px-3 py-2.5">{t('products.colPrice')}</th>
                          <th className="px-3 py-2.5">
                            <span className="sr-only">{t('products.colActions')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field, index) => {
                          const q = parseInt(variationsWatch[index]?.quantity || '0', 10) || 0
                          return (
                            <tr key={field.id} className="border-t border-divider align-top">
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  aria-label={t('products.new.variationPhotoAria', { index: index + 1 })}
                                  onClick={warnPhotoUnavailable}
                                  className="flex size-10 items-center justify-center rounded-tile border border-dashed border-brand-200 bg-brand-50 font-bold text-brand-500"
                                >
                                  <Plus className="size-[18px]" />
                                </button>
                              </td>
                              <td className="px-3 py-2.5">
                                <Controller
                                  control={control}
                                  name={`variations.${index}.name`}
                                  render={({ field }) => (
                                    <input
                                      aria-label={t('products.new.variationNameAria')}
                                      placeholder={t('products.detail.variationNamePlaceholder')}
                                      {...field}
                                      className="h-[42px] w-full min-w-[140px] rounded-[12px] border border-line-strong px-3 text-sm text-ink"
                                    />
                                  )}
                                />
                                {errors.variations?.[index]?.name ? (
                                  <p className="mt-1 text-xs text-danger-strong">
                                    {errors.variations[index]?.name?.message}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label={t('products.decrease')}
                                    onClick={() =>
                                      setValue(`variations.${index}.quantity`, String(Math.max(0, q - 1)))
                                    }
                                    className="flex size-[34px] items-center justify-center rounded-full border border-line-strong bg-surface text-sm font-bold text-ink"
                                  >
                                    −
                                  </button>
                                  <Controller
                                    control={control}
                                    name={`variations.${index}.quantity`}
                                    render={({ field }) => (
                                      <input
                                        type="number"
                                        min={0}
                                        inputMode="numeric"
                                        aria-label={t('products.new.variationQuantityAria')}
                                        {...field}
                                        className="w-[46px] rounded-lg border border-line-strong text-center text-sm font-bold text-ink outline-none focus:border-brand-500"
                                      />
                                    )}
                                  />
                                  <button
                                    type="button"
                                    aria-label={t('products.increase')}
                                    onClick={() => setValue(`variations.${index}.quantity`, String(q + 1))}
                                    className="flex size-[34px] items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
                                  >
                                    +
                                  </button>
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <Controller
                                  control={control}
                                  name={`variations.${index}.price`}
                                  render={({ field }) => (
                                    <input
                                      inputMode="numeric"
                                      aria-label={t('products.new.variationPriceAria')}
                                      placeholder={currency}
                                      {...field}
                                      className="h-[42px] w-[120px] rounded-[12px] border border-line-strong px-3 text-sm font-semibold text-ink"
                                    />
                                  )}
                                />
                                {errors.variations?.[index]?.price ? (
                                  <p className="mt-1 text-xs text-danger-strong">
                                    {errors.variations[index]?.price?.message}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => remove(index)}
                                  className="inline-flex min-h-9 items-center rounded-full border border-danger-border px-3 text-[13px] font-semibold text-danger-strong"
                                >
                                  {t('products.new.remove')}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    onClick={addVariationRow}
                    className="self-start rounded-full border border-dashed border-brand-300 px-4.5 py-2.5 text-sm font-bold text-brand-700"
                  >
                    {t('products.new.addVariationButton')}
                  </button>
                </div>
              )}

              {lowStockRow}
            </Card>
          </div>

          <Card className="glass-panel flex flex-[2_1_320px] flex-col gap-4 rounded-panel p-5">
            <h2 className="text-base font-bold text-ink">{t('products.new.previewTitle')}</h2>
            {previewCard}
            {stockTiles}
            <p className="text-[13px] leading-relaxed text-ink-3">
              {t('products.new.afterSaveHelp')}
            </p>
          </Card>
        </div>
      </form>
    </div>
  )
}
