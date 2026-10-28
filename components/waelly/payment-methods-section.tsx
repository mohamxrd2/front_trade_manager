'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { PaymentMethodDonut } from './payment-method-donut'
import { PaymentMethodTable } from './payment-method-table'
import { PaymentMethodTrendChart } from './payment-method-trend-chart'
import type { PaymentMethod } from '@/lib/payments/methods'
import type { SummaryPaymentMethods, SummaryPeriod } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface PaymentMethodsSectionProps {
  data: SummaryPaymentMethods | undefined
  isLoading: boolean
  period: SummaryPeriod
  startDate: string
  endDate: string
}

/**
 * Section ② (priorité #1 du chantier "stats-paiements") — donut + tableau
 * côte à côte sur ordinateur, empilés sur mobile ; graphique d'évolution en
 * pleine largeur dessous. Un clic sur un segment ou une ligne ouvre la
 * recherche de transactions filtrée par ce moyen de paiement + la période.
 */
function PaymentMethodsSection({ data, isLoading, period, startDate, endDate }: PaymentMethodsSectionProps) {
  const { t } = useTranslation()
  const router = useRouter()

  const goToFilteredSearch = (method: string) => {
    const from = startDate.slice(0, 10)
    const to = endDate.slice(0, 10)
    router.push(`/wallet?payment_method=${method}&from=${from}&to=${to}`)
  }

  const rows = data?.rows ?? []
  const totalRevenue = rows.reduce((sum, row) => sum + row.amount, 0)
  const methodsPresent = rows.map((row) => row.payment_method as PaymentMethod)

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-4.5 shadow-card lg:p-6">
      <h2 className="text-base font-bold text-ink">{t('analytics.page.paymentMethods.sectionTitle')}</h2>

      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-line-strong border-t-brand-500" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:gap-8">
            <PaymentMethodDonut rows={rows} totalRevenue={totalRevenue} onSelect={goToFilteredSearch} />
            <div className="w-full lg:flex-1">
              <PaymentMethodTable rows={rows} onSelect={goToFilteredSearch} />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-divider pt-4">
            <h3 className="text-sm font-bold text-ink">{t('analytics.page.paymentMethods.trendTitle')}</h3>
            <div className="w-full overflow-x-auto">
              <div className="min-w-[480px]">
                <PaymentMethodTrendChart series={data?.series ?? []} methods={methodsPresent} period={period} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export { PaymentMethodsSection }
export type { PaymentMethodsSectionProps }
