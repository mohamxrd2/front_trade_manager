'use client'

import * as React from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipProps } from 'recharts'

import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments/methods'
import type { PaymentMethodSeriesPoint, SummaryPeriod } from '@/lib/services/analytics'
import { useAmountVisibility } from '@/contexts/AmountVisibilityContext'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { bucketLabel, formatTickValue, formatTooltipValue } from '@/lib/analytics/payment-trend-format'
import type { AppLanguage } from '@/lib/i18n/current-language'

interface PaymentMethodTrendChartProps {
  series: PaymentMethodSeriesPoint[]
  methods: PaymentMethod[]
  period: SummaryPeriod
}

function TrendTooltip({ active, payload, label, language, hidden }: TooltipProps<number, string> & { language: AppLanguage; hidden: boolean }) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-tile bg-ink px-3 py-2 text-xs text-white shadow-float">
      <p className="mb-1 font-semibold">{label}</p>
      {payload
        .filter((entry) => (entry.value ?? 0) > 0)
        .map((entry) => {
          const method = entry.dataKey as PaymentMethod
          const meta = PAYMENT_METHODS[method]
          return (
            <p key={method} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                {t(meta.labelKey)}
              </span>
              <span className="font-semibold">{formatTooltipValue(Number(entry.value), language, hidden)}</span>
            </p>
          )
        })}
    </div>
  )
}

/**
 * "Évolution par moyen de paiement" — barres empilées, une couleur par
 * moyen (lib/payments/methods.ts). Légende cliquable : masque/affiche un
 * moyen sans recharger les données (filtre juste les <Bar> rendues).
 * Masquage montants : axe Y et infobulle affichent "•••" (forme et
 * pourcentages du graphe restent visibles, seules les VALEURS sont cachées).
 */
function PaymentMethodTrendChart({ series, methods, period }: PaymentMethodTrendChartProps) {
  const { t, language } = useTranslation()
  const { hidden } = useAmountVisibility()
  const [hiddenMethods, setHiddenMethods] = React.useState<Set<string>>(new Set())

  const data = series.map((point) => ({
    bucket: bucketLabel(point.bucket, period, language),
    ...point.amounts,
  }))

  const toggleMethod = (method: string) => {
    setHiddenMethods((prev) => {
      const next = new Set(prev)
      if (next.has(method)) next.delete(method)
      else next.add(method)
      return next
    })
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--color-subtle)' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-subtle)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatTickValue(value, language, hidden)}
            width={48}
          />
          <Tooltip content={<TrendTooltip language={language} hidden={hidden} />} cursor={{ fill: 'var(--color-surface-soft)' }} />
          <Legend
            onClick={(entry) => toggleMethod(String(entry.dataKey))}
            formatter={(value) => t(PAYMENT_METHODS[value as PaymentMethod]?.labelKey ?? value)}
            wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
          />
          {methods
            .filter((method) => !hiddenMethods.has(method))
            .map((method) => (
              <Bar key={method} dataKey={method} stackId="payment-methods" fill={PAYMENT_METHODS[method].color} radius={[2, 2, 0, 0]} />
            ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export { PaymentMethodTrendChart }
export type { PaymentMethodTrendChartProps }
