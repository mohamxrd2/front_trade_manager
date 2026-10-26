"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext"
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { useCurrency } from "@/lib/utils/currency"
import { formatAmountDisplay } from "@/lib/amount-visibility/format-amount"

/**
 * Affichage UNIQUE pour tout montant sensible (solde, KPI, ligne de
 * transaction…) — respecte le réglage global masqué/visible
 * (AmountVisibilityProvider). Jamais utilisé sur un champ de SAISIE (prix
 * d'article, montant de vente/dépense) : ces champs restent toujours
 * modifiables normalement, voir le besoin d'origine.
 *
 * Largeur stable (tabular-nums + min-width dérivée du montant réel, jamais
 * de la valeur actuellement affichée) : aucun saut de mise en page au
 * basculement — voir lib/amount-visibility/format-amount.ts. Transition en
 * flou de 150 ms, désactivée sous prefers-reduced-motion (motion-reduce:).
 *
 * Lecteur d'écran : un montant masqué est annoncé comme « Montant masqué »
 * (texte sr-only dédié), jamais comme une suite de points — le texte visuel
 * et la devise sont donc retirés de l'arbre d'accessibilité (aria-hidden)
 * dans ce cas.
 */
interface AmountProps {
  value: number
  /** `true` : devise active de l'utilisateur (useCurrency()). Une chaîne : devise explicite. Omis : pas de devise affichée. */
  currency?: boolean | string
  className?: string
  options?: Intl.NumberFormatOptions
}

function Amount({ value, currency, className, options }: AmountProps) {
  const { hidden } = useAmountVisibility()
  const { t, language } = useTranslation()
  const { currency: activeCurrency } = useCurrency()

  const currencyLabel = currency === true ? activeCurrency : typeof currency === "string" ? currency : null
  const { text, minWidthCh } = formatAmountDisplay(value, language, hidden, options)

  return (
    <span data-slot="waelly-amount" className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        aria-hidden={hidden || undefined}
        style={{ minWidth: `${minWidthCh}ch` }}
        className={cn(
          "inline-block tabular-nums transition-[filter] duration-150 ease-out motion-reduce:transition-none",
          hidden && "blur-[3px] select-none"
        )}
      >
        {text}
      </span>
      {hidden ? <span className="sr-only">{t("common.amountHidden")}</span> : null}
      {currencyLabel ? (
        <span aria-hidden={hidden || undefined}>{currencyLabel}</span>
      ) : null}
    </span>
  )
}

export { Amount }
export type { AmountProps }
