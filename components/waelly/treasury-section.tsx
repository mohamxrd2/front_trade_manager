'use client'

import * as React from 'react'

import { Amount } from './amount'
import type { SummaryTreasury } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface TreasurySectionProps {
  treasury: SummaryTreasury | undefined
  isLoading: boolean
}

/**
 * Section ⑥ "Trésorerie" — bloc discret et séparé des autres sections :
 * apports, retraits, solde. Rappel explicite que ces montants ne sont
 * JAMAIS comptés dans le chiffre d'affaires (règle de calcul de la spec).
 */
function TreasurySection({ treasury, isLoading }: TreasurySectionProps) {
  const { t } = useTranslation()

  return (
    <section className="flex flex-col gap-3 rounded-tile border border-line bg-surface-soft p-4">
      <h2 className="text-sm font-bold text-ink">{t('analytics.page.treasury.sectionTitle')}</h2>

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-tile bg-surface" />
      ) : (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-subtle">{t('analytics.page.treasury.deposits')}</span>
            <span className="font-bold text-success-strong">
              +<Amount value={treasury?.deposits ?? 0} /> F
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-subtle">{t('analytics.page.treasury.withdrawals')}</span>
            <span className="font-bold text-danger-strong">
              −<Amount value={treasury?.withdrawals ?? 0} /> F
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-subtle">{t('analytics.page.treasury.balance')}</span>
            <span className="font-bold text-ink">
              <Amount value={treasury?.balance ?? 0} /> F
            </span>
          </div>
        </div>
      )}

      <p className="text-xs text-subtle">{t('analytics.page.treasury.note')}</p>
    </section>
  )
}

export { TreasurySection }
export type { TreasurySectionProps }
