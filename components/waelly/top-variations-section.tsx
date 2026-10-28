'use client'

import * as React from 'react'
import Link from 'next/link'

import { Amount } from './amount'
import type { TopVariationRow } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface TopVariationsSectionProps {
  rows: TopVariationRow[]
  isLoading: boolean
}

/**
 * Section ⑤ "Top variations" — barre horizontale proportionnelle au CA
 * (déjà triées côté backend). Une ligne sans article_id (article supprimé
 * depuis) reste affichée mais n'est pas cliquable.
 */
function TopVariationsSection({ rows, isLoading }: TopVariationsSectionProps) {
  const { t } = useTranslation()
  const maxRevenue = Math.max(0, ...rows.map((r) => r.revenue))

  const content = (
    <div className="flex flex-col gap-3">
      {rows.map((row, index) => {
        const label = row.variation_name ? `${row.article_name} · ${row.variation_name}` : row.article_name
        const widthPercent = maxRevenue > 0 ? Math.max(4, (row.revenue / maxRevenue) * 100) : 0
        return (
          <Link
            key={`${row.article_name}-${row.variation_name ?? ''}-${index}`}
            href={row.article_id ? `/products/${row.article_id}` : '#'}
            onClick={(e) => {
              if (!row.article_id) e.preventDefault()
            }}
            className="flex flex-col gap-1.5 rounded-tile px-2 py-1.5 transition-colors hover:bg-surface-soft"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-ink">{label}</span>
              <span className="shrink-0 font-bold text-ink">
                <Amount value={row.revenue} /> F
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${widthPercent}%` }} />
              </div>
              <span className="shrink-0 text-xs text-subtle">
                {t('analytics.page.topVariations.quantityIcu', { count: row.quantity })}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-4.5 shadow-card lg:p-6">
      <h2 className="text-base font-bold text-ink">{t('analytics.page.topVariations.sectionTitle')}</h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-tile bg-surface-soft" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
      ) : (
        content
      )}
    </section>
  )
}

export { TopVariationsSection }
export type { TopVariationsSectionProps }
