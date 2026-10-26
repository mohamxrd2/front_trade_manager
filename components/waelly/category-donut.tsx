"use client"

import * as React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

import { cn } from "@/lib/utils"

/**
 * Anneau des catégories — design/DESIGN.md § 9 et maquette Web-Tableau.dc.html.
 * PieChart, innerRadius ≈ 70 %, total au centre, légende en dessous.
 */
const DEFAULT_COLORS = ["#2A1A9E", "#6A4CF0", "#A58CFF", "#DCD4FF"]

interface CategoryDonutSlice {
  label: string
  value: number
  color?: string
  /** Liseré intérieur (ex. la tranche la plus claire a besoin d'un contour pour rester visible sur fond blanc). */
  ringColor?: string
}

interface CategoryDonutProps {
  data: CategoryDonutSlice[]
  centerValue: React.ReactNode
  centerLabel: string
  size?: number
  className?: string
  /** 'column' (défaut) : anneau centré, légende dessous. 'row' : anneau et légende côte à côte (ex. maquette mobile Web-Analyses). */
  layout?: "column" | "row"
}

function CategoryDonut({
  data,
  centerValue,
  centerLabel,
  size = 168,
  className,
  layout = "column",
}: CategoryDonutProps) {
  // Une seule tranche couvrant 100 % produit un arc SVG dégénéré (le point de
  // départ et d'arrivée coïncident après un tour complet) : invisible côté
  // rendu. On retire un epsilon négligeable pour garder un vrai arc tracé.
  const colored = data.map((slice, index) => ({
    ...slice,
    value: data.length === 1 ? Math.max(0, slice.value - 0.01) : slice.value,
    color: slice.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }))

  return (
    <div
      data-slot="waelly-category-donut"
      className={cn(
        layout === "row" ? "flex items-center gap-4" : "flex flex-col gap-4.5",
        className
      )}
    >
      <div className={cn("relative shrink-0", layout === "column" && "mx-auto")} style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {colored.map((slice) => (
                <Cell
                  key={slice.label}
                  fill={slice.color}
                  stroke={slice.ringColor}
                  strokeWidth={slice.ringColor ? 1 : 0}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-6 flex flex-col items-center justify-center rounded-full bg-surface">
          <span className="text-lg font-bold text-ink">{centerValue}</span>
          <span className="text-xs text-subtle">{centerLabel}</span>
        </div>
      </div>

      <div className={cn("flex flex-col gap-2.5 text-sm", layout === "row" && "flex-1")}>
        {colored.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2.5">
            <span
              className="size-2.5 rounded-full"
              style={{
                background: slice.color,
                boxShadow: slice.ringColor ? `inset 0 0 0 1px ${slice.ringColor}` : undefined,
              }}
            />
            <span className="flex-1 text-ink-2">{slice.label}</span>
            <span className="font-bold text-ink">{slice.value} %</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export { CategoryDonut }
export type { CategoryDonutProps, CategoryDonutSlice }
