"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext"
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"

/**
 * Bouton « œil » — bascule le réglage global masqué/visible
 * (AmountVisibilityProvider). Deux variantes visuelles :
 * - "hero" : pastille blanche à 14 % d'opacité sur fond sombre (carte navy
 *   « Solde du mois »/« Solde » du Portefeuille) — zone tactile 44×44,
 *   pastille visuelle 36×36, icône blanche 20px, mobile ET ordinateur.
 * - "glass" : même traitement que les autres boutons "verre" de l'en-tête
 *   (ex. la cloche de notifications) — second point d'accès ordinateur.
 */
interface AmountVisibilityToggleProps {
  variant?: "hero" | "glass"
  className?: string
}

function AmountVisibilityToggle({ variant = "hero", className }: AmountVisibilityToggleProps) {
  const { hidden, toggle } = useAmountVisibility()
  const { t } = useTranslation()
  const label = hidden ? t("common.showAmounts") : t("common.hideAmounts")

  if (variant === "glass") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={hidden}
        aria-label={label}
        title={label}
        className={cn("glass flex size-12 items-center justify-center rounded-full text-ink", className)}
      >
        {hidden ? <EyeOff className="size-5" strokeWidth={1.8} /> : <Eye className="size-5" strokeWidth={1.8} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      // Zone tactile 44×44 (size-11), pastille visuelle 36×36 (size-9) centrée
      // dedans — les deux tailles demandées sans superposer bordure/fond.
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", className)}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-white/14 text-white">
        {hidden ? <EyeOff className="size-5" strokeWidth={1.8} /> : <Eye className="size-5" strokeWidth={1.8} />}
      </span>
    </button>
  )
}

export { AmountVisibilityToggle }
export type { AmountVisibilityToggleProps }
