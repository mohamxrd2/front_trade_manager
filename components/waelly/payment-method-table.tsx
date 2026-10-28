'use client'

import * as React from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Amount } from './amount'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments/methods'
import type { PaymentMethodRow } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'

interface PaymentMethodTableProps {
  rows: PaymentMethodRow[]
  onSelect: (method: string) => void
}

/**
 * Tableau-liste sous le donut — triée par montant décroissant (déjà fait côté
 * backend). Chaque ligne ouvre la recherche de transactions filtrée par ce
 * moyen de paiement + la période courante. Nb de ventes et panier moyen sont
 * affichés en sous-ligne (3 colonnes visuelles plutôt que 6) pour rester
 * lisible à 390px — toutes les données de la spec restent présentes.
 */
function PaymentMethodTable({ rows, onSelect }: PaymentMethodTableProps) {
  const { t, language } = useTranslation()

  return (
    <div className="flex flex-col divide-y divide-divider rounded-tile border border-line">
      {rows.map((row) => {
        const meta = PAYMENT_METHODS[row.payment_method as PaymentMethod] ?? PAYMENT_METHODS.non_precise
        const Icon = meta.Icon
        const positive = row.change_percent >= 0

        return (
          <button
            key={row.payment_method}
            type="button"
            onClick={() => onSelect(row.payment_method)}
            className="flex items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-soft"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${meta.color}1F`, color: meta.color }}
            >
              <Icon className="size-4" strokeWidth={2.2} />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold text-ink">{t(meta.labelKey)}</span>
              <span className="truncate text-xs text-subtle">
                {t('analytics.page.paymentMethods.salesCountIcu', { count: row.sales_count })} ·{' '}
                {t('analytics.page.paymentMethods.averageBasketInline')} <Amount value={row.average_basket} />
              </span>
            </span>

            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-bold text-ink">
                <Amount value={row.amount} />
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className="text-subtle">{formatNumber(row.percentage, language, { maximumFractionDigits: 0 })}%</span>
                <span className={`flex items-center gap-0.5 font-semibold ${positive ? 'text-success' : 'text-danger'}`}>
                  {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                  {formatNumber(Math.abs(row.change_percent), language, { maximumFractionDigits: 0 })}%
                </span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { PaymentMethodTable }
export type { PaymentMethodTableProps }
