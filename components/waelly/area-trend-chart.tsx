"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { DotProps, TooltipProps } from "recharts"
import { ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Graphique de tendance « Monthly Trend » — design/DESIGN.md § 9.
 * Recharts AreaChart, ligne #5B3FE6, remplissage dégradé, grille pointillée
 * horizontale uniquement. Point et bulle de valeur STATIQUES sur le seul
 * dernier point (pas de survol) — comme Web-Tableau.dc.html.
 */
interface AreaTrendPoint {
  label: string
  value: number
}

interface AreaTrendSecondarySeries {
  data: AreaTrendPoint[]
  color?: string
  label?: string
}

interface AreaTrendChartProps {
  data: AreaTrendPoint[]
  trendPercent?: number
  trendLabel?: string
  title?: string
  actions?: React.ReactNode
  height?: number
  className?: string
  /** Borne haute explicite de l'axe Y (ex. palier arrondi 100k/300k/600k/2M) : fixe le domaine et les 4 graduations à [0, max/3, 2max/3, max] au lieu de l'auto-échelle Recharts. */
  yMax?: number
  /** Active l'infobulle Recharts au survol (ordinateur) / toucher (mobile) sur les points non-finaux — le dernier point garde sa bulle statique. */
  showTooltip?: boolean
  /** Seconde courbe (ex. dépenses) tracée en parallèle de la série principale, sur le même axe — même nombre de points / mêmes libellés que `data`. */
  secondarySeries?: AreaTrendSecondarySeries
  /** Libellé de la série principale, utilisé dans la légende quand `secondarySeries` est fourni. */
  primaryLabel?: string
}

type MergedPoint = AreaTrendPoint & { value2?: number }

function ChartTooltip({ active, payload, primaryLabel, secondaryLabel, secondaryColor }: TooltipProps<number, string> & { primaryLabel: string; secondaryLabel?: string; secondaryColor?: string }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as MergedPoint | undefined
  if (!point) return null
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line-strong bg-surface px-3 py-2 text-xs font-bold text-ink shadow-card">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "#5B3FE6" }} />
        {secondaryLabel ? `${primaryLabel} : ` : ""}{formatBubbleValue(point.value)}
      </span>
      {secondaryLabel && point.value2 !== undefined ? (
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: secondaryColor ?? "#D92D20" }} />
          {secondaryLabel} : {formatBubbleValue(point.value2)}
        </span>
      ) : null}
    </div>
  )
}

function formatAbbreviated(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1).replace(".", ",")}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000)}k`
  }
  return String(value)
}

const formatBubbleValue = (value: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F`

function LastPointMarker(
  props: DotProps & { index?: number; dataLength: number }
) {
  const { cx, cy, index, dataLength } = props
  if (index !== dataLength - 1 || cx == null || cy == null) return null

  const label = formatBubbleValue((props as unknown as { payload?: { value: number } }).payload?.value ?? 0)
  const pillWidth = Math.max(54, label.length * 7 + 20)
  const pillHeight = 24
  // Le dernier point est toujours le plus à droite du graphique : on ancre
  // la pilule par son bord DROIT (juste après le point) plutôt que de la
  // centrer sur cx, pour qu'elle ne déborde jamais hors du cadre.
  const pillX = Math.max(4, cx + 6 - pillWidth)

  return (
    <g>
      <rect
        x={pillX}
        y={cy - pillHeight - 14}
        width={pillWidth}
        height={pillHeight}
        rx={pillHeight / 2}
        fill="#0E0E1A"
      />
      <text
        x={pillX + pillWidth / 2}
        y={cy - pillHeight / 2 - 14 + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#FFFFFF"
      >
        {label}
      </text>
      <circle cx={cx} cy={cy} r={6} fill="#FFFFFF" stroke="#5B3FE6" strokeWidth={3} />
    </g>
  )
}

/** Marqueur de fin de la série secondaire (ex. dépenses) : un point simple, sans bulle, pour ne pas surcharger le graphique à côté de la bulle principale. */
function SecondaryLastPointMarker(
  props: DotProps & { index?: number; dataLength: number; color: string }
) {
  const { cx, cy, index, dataLength, color } = props
  if (index !== dataLength - 1 || cx == null || cy == null) return null
  return <circle cx={cx} cy={cy} r={5} fill="#FFFFFF" stroke={color} strokeWidth={3} />
}

function AreaTrendChart({
  data,
  trendPercent,
  trendLabel = "de plus que la période précédente",
  title,
  actions,
  height = 220,
  className,
  yMax,
  showTooltip = false,
  secondarySeries,
  primaryLabel = "Ventes",
}: AreaTrendChartProps) {
  const gradientId = React.useId().replace(/:/g, "")
  const secondaryColor = secondarySeries?.color ?? "#D92D20"
  const mergedData: MergedPoint[] = data.map((p, i) => ({
    ...p,
    value2: secondarySeries?.data[i]?.value,
  }))

  return (
    <div data-slot="waelly-area-trend-chart" className={cn("flex flex-col gap-3.5", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {title ? <span className="text-base font-bold text-ink">{title}</span> : <span />}
          {actions}
        </div>
      )}

      {secondarySeries ? (
        <div className="flex gap-4 text-xs" style={{ color: "#4B4B5C" }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded" style={{ background: "#5B3FE6" }} />
            {primaryLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded" style={{ background: secondaryColor }} />
            {secondarySeries.label ?? "Dépenses"}
          </span>
        </div>
      ) : null}

      {typeof trendPercent === "number" ? (
        <span className="text-[13px] text-ink-3">
          <span className="inline-flex items-center gap-0.5 font-bold text-success">
            <ArrowUp className="size-3" strokeWidth={3} />
            {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.abs(trendPercent))} %
          </span>{" "}
          {trendLabel}
        </span>
      ) : null}

      <div style={{ height: height + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mergedData} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6A4CF0" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6A4CF0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              horizontal
              vertical={false}
              stroke="#ECECF2"
              strokeDasharray="3 4"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={(props) => {
                const { x, y, payload, index } = props
                const isLast = index === mergedData.length - 1
                return (
                  <text
                    x={x}
                    y={y + 14}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={isLast ? 700 : 400}
                    fill={isLast ? "#0E0E1A" : "#6B6B7B"}
                  >
                    {payload.value}
                  </text>
                )
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#6B6B7B" }}
              tickFormatter={formatAbbreviated}
              width={36}
              domain={yMax ? [0, yMax] : undefined}
              ticks={yMax ? [0, yMax / 3, (yMax * 2) / 3, yMax] : undefined}
            />
            {showTooltip ? (
              <Tooltip
                content={
                  <ChartTooltip
                    primaryLabel={primaryLabel}
                    secondaryLabel={secondarySeries?.label ?? (secondarySeries ? "Dépenses" : undefined)}
                    secondaryColor={secondaryColor}
                  />
                }
                cursor={{ stroke: "#ECECF2" }}
              />
            ) : null}
            {secondarySeries ? (
              <Area
                type="monotone"
                dataKey="value2"
                stroke={secondaryColor}
                strokeWidth={2.5}
                fill="none"
                isAnimationActive={false}
                dot={({ key, ...dotProps }) => (
                  <SecondaryLastPointMarker
                    key={key ?? dotProps.index}
                    {...dotProps}
                    dataLength={mergedData.length}
                    color={secondaryColor}
                  />
                )}
                activeDot={showTooltip ? { r: 4, fill: secondaryColor, stroke: "#FFFFFF", strokeWidth: 2 } : false}
              />
            ) : null}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#5B3FE6"
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={({ key, ...dotProps }) => (
                <LastPointMarker key={key ?? dotProps.index} {...dotProps} dataLength={mergedData.length} />
              )}
              activeDot={showTooltip ? { r: 5, fill: "#5B3FE6", stroke: "#FFFFFF", strokeWidth: 2 } : false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export { AreaTrendChart }
export type { AreaTrendChartProps, AreaTrendPoint }
