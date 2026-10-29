'use client'

import * as React from 'react'

import { Amount } from './amount'
import type { MemberSalesRow } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface MemberSalesSectionProps {
  rows: MemberSalesRow[]
  isLoading: boolean
}

/**
 * Chantier "Équipe" §7 — "Ventes par membre" : montant, nombre de ventes et
 * panier moyen par membre (déjà triés par montant côté backend, voir
 * AnalyticsSummaryService::byMember()). Un propriétaire sans équipe n'a
 * qu'une seule ligne — la section reste utile (confirme "qui a vendu").
 */
function MemberSalesSection({ rows, isLoading }: MemberSalesSectionProps) {
  const { t } = useTranslation()
  const maxAmount = Math.max(0, ...rows.map((r) => r.amount))

  const content = (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const widthPercent = maxAmount > 0 ? Math.max(4, (row.amount / maxAmount) * 100) : 0
        return (
          <div key={row.user_id} className="flex flex-col gap-1.5 rounded-tile px-2 py-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-ink">{row.name ?? '—'}</span>
              <span className="shrink-0 font-bold text-ink">
                <Amount value={row.amount} currency />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${widthPercent}%` }} />
              </div>
              <span className="shrink-0 text-xs text-subtle">
                {t('analytics.page.memberSales.salesCountIcu', { count: row.sales_count })}
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs text-subtle">
              {t('analytics.page.memberSales.averageBasketLabel')}
              <Amount value={row.average_basket} currency />
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-4.5 shadow-card lg:p-6">
      <h2 className="text-base font-bold text-ink">{t('analytics.page.memberSales.sectionTitle')}</h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-tile bg-surface-soft" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
      ) : (
        content
      )}
    </section>
  )
}

export { MemberSalesSection }
export type { MemberSalesSectionProps }
