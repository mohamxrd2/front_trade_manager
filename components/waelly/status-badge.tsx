import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Badge de statut — design/DESIGN.md § 7.
 * Pilule 12px, graisse 700.
 */
const STATUS_STYLES = {
  payee: "bg-success-bg text-success-strong",
  envoyee: "bg-warning-bg text-warning",
  brouillon: "bg-neutral-bg text-neutral",
  "stock-faible": "bg-danger-bg text-danger-strong",
  disponible: "bg-success-bg text-success-strong",
} as const

const TONE_STYLES = {
  success: "bg-success-bg text-success-strong",
  danger: "bg-danger-bg text-danger-strong",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
  // Indigo (#3A20B8) — ex. type "Apport" sur Portefeuille : ne doit jamais
  // être confondu avec une vente (success/vert), d'où un ton dédié.
  brand: "bg-brand-100 text-brand-700",
} as const

type StatusKey = keyof typeof STATUS_STYLES
type ToneKey = keyof typeof TONE_STYLES

const STATUS_LABELS: Record<StatusKey, string> = {
  payee: "Payée",
  envoyee: "Envoyée",
  brouillon: "Brouillon",
  "stock-faible": "Stock faible",
  disponible: "Disponible",
}

interface StatusBadgeProps {
  status?: StatusKey
  tone?: ToneKey
  label?: string
  className?: string
}

function StatusBadge({ status, tone, label, className }: StatusBadgeProps) {
  const style = status ? STATUS_STYLES[status] : tone ? TONE_STYLES[tone] : TONE_STYLES.neutral
  const text = label ?? (status ? STATUS_LABELS[status] : "")

  return (
    <span
      data-slot="waelly-status-badge"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        style,
        className
      )}
    >
      {text}
    </span>
  )
}

export { StatusBadge }
export type { StatusBadgeProps, StatusKey, ToneKey }
