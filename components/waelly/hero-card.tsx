import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Carte « héros » (solde, total) — design/DESIGN.md § 7 et maquettes
 * Main.dc.html (mobile, grille Ventes/Dépenses) et Web-Tableau.dc.html
 * (ordinateur, objectif + actions).
 */
interface HeroCardStat {
  label: string
  value: React.ReactNode
}

interface HeroCardProgress {
  label: string
  current: string
  target: string
  percent: number
}

interface HeroCardProps {
  label: string
  period?: string
  amount: React.ReactNode
  currency?: string
  stats?: HeroCardStat[]
  progress?: HeroCardProgress
  actions?: React.ReactNode
  /** Emplacement du bouton « œil » (masquer/afficher les montants) — rendu entre le libellé et la pastille de période. */
  eyeButton?: React.ReactNode
  className?: string
}

function HeroCard({
  label,
  period,
  amount,
  currency = "FCFA",
  stats,
  progress,
  actions,
  eyeButton,
  className,
}: HeroCardProps) {
  return (
    <div
      data-slot="waelly-hero-card"
      className={cn(
        "flex flex-col gap-5 rounded-hero bg-hero p-6 text-white shadow-hero",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] text-navy-text">{label}</span>
        <span className="flex items-center gap-2">
          {eyeButton}
          {period ? (
            <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1.5 text-xs font-semibold">
              {period}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[38px] font-bold tracking-tight md:text-[46px]">
          {amount}
        </span>
        <span className="text-base font-semibold text-navy-text">
          {currency}
        </span>
      </div>

      {progress ? (
        <div className="flex flex-col gap-2.5 rounded-tile border border-white/16 bg-white/10 px-4 py-3.5">
          <div className="flex justify-between text-[13px] text-navy-text-2">
            <span>
              {progress.label} · {progress.percent} %
            </span>
            <span>
              {progress.current} / {progress.target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/22">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 rounded-tile bg-white/10 p-3"
            >
              <span className="text-xs text-navy-text">{stat.label}</span>
              <span className="text-base font-bold">{stat.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {actions ? (
        <div className="flex flex-wrap gap-2.5">{actions}</div>
      ) : null}
    </div>
  )
}

export { HeroCard }
export type { HeroCardProps, HeroCardStat, HeroCardProgress }
