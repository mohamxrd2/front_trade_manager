import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Ligne de transaction — design/DESIGN.md § 7 et maquette Main.dc.html.
 * Icône ronde, titre + méta, montant coloré à droite.
 */
interface TransactionRowProps {
  icon: React.ReactNode
  title: string
  meta: string
  amount: React.ReactNode
  type: "income" | "expense"
  className?: string
  /** Rend la ligne cliquable (ex. ouvrir le détail de la transaction) — rendu en <button>, sinon <div>. */
  onClick?: () => void
}

function TransactionRow({
  icon,
  title,
  meta,
  amount,
  type,
  className,
  onClick,
}: TransactionRowProps) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      data-slot="waelly-transaction-row"
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left",
        onClick && "active:bg-surface-soft",
        className
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          type === "income"
            ? "bg-brand-100 text-brand-500"
            : "bg-danger-bg text-danger"
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-ink">
          {title}
        </span>
        <span className="truncate text-xs text-subtle">{meta}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-bold",
          type === "income" ? "text-success" : "text-danger"
        )}
      >
        {amount}
      </span>
    </Comp>
  )
}

export { TransactionRow }
export type { TransactionRowProps }
