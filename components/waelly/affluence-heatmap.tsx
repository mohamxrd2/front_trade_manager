'use client'

import * as React from 'react'

import { Amount } from './amount'
import type { HeatmapCell } from '@/lib/services/analytics'
import { PERIOD_KEYS, bestMoments, referenceDateForDayOfWeek } from '@/lib/analytics/heatmap'
import { useAmountVisibility } from '@/contexts/AmountVisibilityContext'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'

interface AffluenceHeatmapProps {
  cells: HeatmapCell[]
  isLoading: boolean
}

interface GridCell {
  dayOfWeek: number
  hourStart: number
  hourEnd: number
  revenue: number
  salesCount: number
}

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] // lundi…dimanche (jour_de_semaine API : 0=dimanche)

function buildGrid(cells: HeatmapCell[], bucketHours: 1 | 2): GridCell[][] {
  const byKey = new Map<string, { revenue: number; salesCount: number }>()
  for (const cell of cells) {
    const bucketStart = Math.floor(cell.hour / bucketHours) * bucketHours
    const key = `${cell.day_of_week}-${bucketStart}`
    const existing = byKey.get(key)
    if (existing) {
      existing.revenue += cell.revenue
      existing.salesCount += cell.sales_count
    } else {
      byKey.set(key, { revenue: cell.revenue, salesCount: cell.sales_count })
    }
  }

  return DAYS_ORDER.map((dayOfWeek) =>
    Array.from({ length: 24 / bucketHours }, (_, i) => {
      const hourStart = i * bucketHours
      const found = byKey.get(`${dayOfWeek}-${hourStart}`)
      return {
        dayOfWeek,
        hourStart,
        hourEnd: hourStart + bucketHours,
        revenue: found?.revenue ?? 0,
        salesCount: found?.salesCount ?? 0,
      }
    })
  )
}

function cellBackground(revenue: number, max: number): string {
  if (max <= 0 || revenue <= 0) return 'rgba(91, 63, 230, 0.06)'
  const alpha = 0.12 + 0.78 * (revenue / max)
  return `rgba(91, 63, 230, ${alpha.toFixed(2)})`
}

function HeatmapGrid({ grid, max, dayLabels, onSelect }: { grid: GridCell[][]; max: number; dayLabels: string[]; onSelect: (cell: GridCell) => void }) {
  return (
    <div className="flex gap-1.5">
      <div className="flex flex-col gap-1 pt-0">
        {dayLabels.map((label) => (
          <span key={label} className="flex h-5 items-center text-[10px] font-semibold text-subtle">
            {label}
          </span>
        ))}
      </div>
      <div className="flex-1 overflow-x-auto">
        <div className="flex flex-col gap-1" style={{ minWidth: grid[0]?.length ? grid[0].length * 18 : undefined }}>
          {grid.map((row, rowIndex) => (
            <div key={dayLabels[rowIndex]} className="flex gap-1">
              {row.map((cell) => (
                <button
                  key={`${cell.dayOfWeek}-${cell.hourStart}`}
                  type="button"
                  onClick={() => onSelect(cell)}
                  className="h-5 flex-1 rounded-[4px] transition-transform hover:scale-110"
                  style={{ backgroundColor: cellBackground(cell.revenue, max) }}
                  aria-label={`${cell.hourStart}h–${cell.hourEnd}h`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Section ④ "Heures d'affluence" — grille 7j×24h (ordinateur) ou 7j×2h
 * (mobile, plus lisible au doigt), intensité = CA (dégradé violet de
 * marque). Tap/clic affiche le détail sous la grille. Phrase
 * auto-générée sous la grille (lib/analytics/heatmap.ts).
 */
function AffluenceHeatmap({ cells, isLoading }: AffluenceHeatmapProps) {
  const { t, language } = useTranslation()
  const { hidden } = useAmountVisibility()
  const [selected, setSelected] = React.useState<GridCell | null>(null)

  const dayLabels = DAYS_ORDER.map((d) => formatDate(referenceDateForDayOfWeek(d), language, 'ddd'))

  const gridDesktop = React.useMemo(() => buildGrid(cells, 1), [cells])
  const gridMobile = React.useMemo(() => buildGrid(cells, 2), [cells])
  const max = Math.max(0, ...cells.map((c) => c.revenue))

  const moments = React.useMemo(() => bestMoments(cells), [cells])
  const momentLabel = (bucket: { dayOfWeek: number; period: 0 | 1 | 2 | 3 }) =>
    `${formatDate(referenceDateForDayOfWeek(bucket.dayOfWeek), language, 'dddd')} ${t(PERIOD_KEYS[bucket.period])}`

  const sentence = !moments
    ? null
    : moments.second
      ? t('analytics.page.heatmap.bestMoments', { first: momentLabel(moments.first), second: momentLabel(moments.second) })
      : t('analytics.page.heatmap.bestMomentSingle', { first: momentLabel(moments.first) })

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4 rounded-card bg-surface p-4.5 shadow-card lg:p-6">
        <h2 className="text-base font-bold text-ink">{t('analytics.page.heatmap.sectionTitle')}</h2>
        <div className="h-[180px] animate-pulse rounded-tile bg-surface-soft" />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface p-4.5 shadow-card lg:p-6">
      <h2 className="text-base font-bold text-ink">{t('analytics.page.heatmap.sectionTitle')}</h2>

      {cells.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t('analytics.page.noSalesInPeriod')}</p>
      ) : (
        <>
          <div className="hidden lg:block">
            <HeatmapGrid grid={gridDesktop} max={max} dayLabels={dayLabels} onSelect={setSelected} />
          </div>
          <div className="lg:hidden">
            <HeatmapGrid grid={gridMobile} max={max} dayLabels={dayLabels} onSelect={setSelected} />
          </div>

          <div className="min-h-[20px] text-sm font-semibold text-ink">
            {selected ? (
              <span>
                {formatDate(referenceDateForDayOfWeek(selected.dayOfWeek), language, 'dddd')} {selected.hourStart}h–{selected.hourEnd}h ·{' '}
                {t('analytics.page.heatmap.salesCountIcu', { count: selected.salesCount })} ·{' '}
                {hidden ? '•••' : <Amount value={selected.revenue} />} {hidden ? null : 'F'}
              </span>
            ) : null}
          </div>

          {sentence ? <p className="text-sm text-subtle">{sentence}</p> : null}
        </>
      )}
    </section>
  )
}

export { AffluenceHeatmap }
export type { AffluenceHeatmapProps }
