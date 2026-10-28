'use client'

import * as React from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from 'recharts'
import type { PieSectorDataItem } from 'recharts/types/polar/Pie'

import { Amount } from './amount'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments/methods'
import type { PaymentMethodRow } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface PaymentMethodDonutProps {
  rows: PaymentMethodRow[]
  totalRevenue: number
  onSelect: (method: string) => void
  size?: number
}

/**
 * Anneau "Encaissements par moyen de paiement" — le total (masquable via
 * l'œil) au centre, un segment par moyen avec sa couleur FIXE (voir
 * lib/payments/methods.ts). Le segment survolé/tapé s'agrandit légèrement
 * (pattern Recharts officiel : Pie.activeIndex + activeShape=<Sector> plus
 * grand) puis le clic ouvre la recherche de transactions filtrée.
 */
function PaymentMethodDonut({ rows, totalRevenue, onSelect, size = 180 }: PaymentMethodDonutProps) {
  const { t } = useTranslation()
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  const slices = rows.map((row) => ({
    method: row.payment_method as PaymentMethod,
    value: row.amount,
  }))
  // Un seul segment couvrant 100% produit un arc dégénéré (invisible) — un
  // epsilon négligeable garde un vrai arc tracé (même parade que CategoryDonut).
  const colored = slices.map((s) => ({ ...s, value: slices.length === 1 ? Math.max(0, s.value - 0.01) : s.value }))

  const renderActiveShape = (props: PieSectorDataItem) => (
    <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 6} />
  )

  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={colored}
            dataKey="value"
            nameKey="method"
            innerRadius="68%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            activeIndex={activeIndex ?? undefined}
            activeShape={renderActiveShape}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            onClick={(_, index) => onSelect(colored[index].method)}
          >
            {colored.map((slice, index) => {
              const meta = PAYMENT_METHODS[slice.method]
              return (
                <Cell
                  key={slice.method}
                  fill={meta.hatched ? `url(#payment-method-hatch-${index})` : meta.color}
                  className="cursor-pointer outline-none"
                />
              )
            })}
          </Pie>
          <defs>
            {colored.map((slice, index) =>
              PAYMENT_METHODS[slice.method].hatched ? (
                <pattern
                  key={slice.method}
                  id={`payment-method-hatch-${index}`}
                  width="6"
                  height="6"
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="6" height="6" fill={PAYMENT_METHODS[slice.method].color} />
                  <line x1="0" y1="0" x2="0" y2="6" stroke="#FFFFFF" strokeWidth="2" />
                </pattern>
              ) : null
            )}
          </defs>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-7 flex flex-col items-center justify-center rounded-full bg-surface text-center">
        <span className="text-lg font-bold text-ink">
          <Amount value={totalRevenue} />
        </span>
        <span className="text-xs text-subtle">{t('analytics.page.paymentMethods.totalLabel')}</span>
      </div>
    </div>
  )
}

export { PaymentMethodDonut }
export type { PaymentMethodDonutProps }
