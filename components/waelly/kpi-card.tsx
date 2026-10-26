import * as React from "react"
import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Carte KPI — design/DESIGN.md § 7 et maquette Web-Tableau.dc.html.
 * Label 13px 600, valeur 26–28px 700 (tracking -0.02em), variation 13px 700.
 *
 * `trend` (direction de la flèche, ↑ si la valeur a monté, ↓ si elle a
 * baissé) et `positive` (couleur verte/rouge) sont volontairement
 * indépendants : une hausse des dépenses pointe vers le haut (↑) mais reste
 * rouge (negative) — les confondre produit des flèches contradictoires.
 */
interface KpiCardProps {
  label: string
  value: React.ReactNode
  delta?: string
  trend?: "up" | "down"
  positive?: boolean
  dotColor?: string
  className?: string
}

function KpiCard({
  label,
  value,
  delta,
  trend = "up",
  positive = true,
  dotColor,
  className,
}: KpiCardProps) {
  return (
    <div
      data-slot="waelly-kpi-card"
      className={cn(
        "flex flex-col gap-2 rounded-card bg-surface p-[18px] shadow-card",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-subtle">{label}</span>
        {dotColor ? (
          <span
            className="size-2.5 rounded-full"
            style={{ background: dotColor }}
          />
        ) : null}
      </div>
      <span className="text-[26px] font-bold tracking-[-0.02em] text-ink md:text-[28px]">
        {value}
      </span>
      {delta ? (
        <span
          className={cn(
            "flex items-center gap-1 text-[13px] font-bold",
            positive ? "text-success" : "text-danger"
          )}
        >
          {trend === "up" ? (
            <ArrowUp className="size-3.5" strokeWidth={2.5} />
          ) : (
            <ArrowDown className="size-3.5" strokeWidth={2.5} />
          )}
          {delta}
        </span>
      ) : null}
    </div>
  )
}

export { KpiCard }
export type { KpiCardProps }
