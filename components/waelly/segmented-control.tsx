"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Contrôle segmenté (sélecteur de période) — valeurs exactes reprises du
 * sélecteur de Web-Tableau.dc.html : conteneur verre, option active = pilule
 * noire, inactive = transparente.
 */
interface SegmentedControlOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** Par défaut "Période" (non traduit) — les appelants i18n passent leur propre libellé traduit. */
  ariaLabel?: string
}

function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel = "Période",
}: SegmentedControlProps) {
  return (
    <div
      data-slot="waelly-segmented-control"
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "glass inline-flex gap-1 rounded-full p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-[38px] rounded-full px-4 text-[13px] transition-colors",
              active
                ? "bg-active font-bold text-white"
                : "bg-transparent font-semibold text-ink-2"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { SegmentedControl }
export type { SegmentedControlProps, SegmentedControlOption }
