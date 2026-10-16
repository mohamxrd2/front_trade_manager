"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Filtres en chips — design/DESIGN.md § 7.
 * Pilule 40px. Actif = fond ink + texte blanc. Inactif = blanc + bordure + ink-2.
 */
interface FilterChipOption {
  value: string
  label: string
}

interface FilterChipsProps {
  options: FilterChipOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

function FilterChips({ options, value, onChange, className }: FilterChipsProps) {
  return (
    <div
      data-slot="waelly-filter-chips"
      role="group"
      className={cn("flex flex-wrap gap-2", className)}
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
              "flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
              active
                ? "bg-active text-white"
                : "border border-line-strong bg-surface text-ink-2"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export { FilterChips }
export type { FilterChipsProps, FilterChipOption }
