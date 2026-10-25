'use client'

import type { Variation } from '@/lib/services/articles'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface VariationPickerProps {
  variations: Variation[]
  selectedVariationId: string | null
  onSelect: (variation: Variation) => void
  /** Numéro d'étape affiché devant le titre (ex. "2." dans un formulaire à étapes). */
  stepLabel?: string
}

/**
 * Sélecteur de variation en chips (nom + prix + restant), partagé entre
 * /wallet/new (vente) et /invoices/new (ligne de facture) — toute vente ou
 * ligne de facture sur un article variable exige de choisir une variation
 * ici, le prix par défaut proposé est celui DE LA VARIATION choisie.
 * Les variations épuisées restent visibles mais non sélectionnables.
 */
export function VariationPicker({ variations, selectedVariationId, onSelect, stepLabel }: VariationPickerProps) {
  const { t } = useTranslation()
  if (variations.length === 0) return null

  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-lg font-bold text-ink">
        {stepLabel ? <span className="text-brand-300">{stepLabel}</span> : null} {t('products.variationPicker.title')}
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {variations.map((variation) => {
          const active = variation.id === selectedVariationId
          const empty = variation.remaining_quantity <= 0
          return (
            <button
              key={variation.id}
              type="button"
              aria-pressed={active}
              disabled={empty}
              onClick={() => onSelect(variation)}
              className={`flex min-w-[100px] flex-col items-center justify-center gap-0.5 rounded-tile px-3.5 py-2.5 text-sm font-bold disabled:cursor-not-allowed ${
                active
                  ? 'bg-brand-500 text-white'
                  : empty
                    ? 'border border-dashed border-line-strong bg-canvas text-subtle opacity-60'
                    : 'border border-line-strong bg-surface text-ink'
              }`}
            >
              {variation.name}
              <span className={`text-xs font-normal ${active ? 'text-brand-100' : empty ? 'text-danger-strong' : 'text-subtle'}`}>
                {empty ? t('products.variationPicker.outOfStock') : t('products.variationPicker.available', { count: variation.remaining_quantity })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
