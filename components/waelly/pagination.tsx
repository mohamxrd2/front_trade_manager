"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Pagination numérotée — design/DESIGN.md § 7 (tableaux). Introduite pour
 * /wallet (Portefeuille), réutilisée telle quelle par /invoices (Factures).
 * Ne montre jamais plus de ~7 boutons : 1 … courante-1 courante courante+1 …
 * dernière, pour ne jamais déborder même avec des dizaines de pages.
 */
interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Résumé affiché à gauche, ex. "10 opération(s) affichée(s) sur 42" */
  summary?: React.ReactNode
  className?: string
}

function Pagination({ page, pageCount, onPageChange, summary, className }: PaginationProps) {
  if (pageCount <= 1) return null

  const visiblePages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1
  )

  return (
    <div
      data-slot="waelly-pagination"
      className={cn("flex flex-wrap items-center justify-between gap-2.5 text-[13px] text-subtle", className)}
    >
      {summary ? <span>{summary}</span> : <span />}
      <span className="flex flex-wrap justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="flex min-h-10 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm font-bold text-ink disabled:opacity-40"
        >
          Précédent
        </button>
        {visiblePages.map((p, i) => (
          <React.Fragment key={p}>
            {i > 0 && visiblePages[i - 1] !== p - 1 ? (
              <span className="flex min-h-10 items-center px-1 text-ink-3">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "flex min-h-10 min-w-10 items-center justify-center rounded-full text-sm font-bold",
                p === page ? "bg-active text-white" : "border border-line-strong bg-surface text-ink"
              )}
            >
              {p}
            </button>
          </React.Fragment>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="flex min-h-10 items-center rounded-full border border-line-strong bg-surface px-3.5 text-sm font-bold text-ink disabled:opacity-40"
        >
          Suivant
        </button>
      </span>
    </div>
  )
}

export { Pagination }
export type { PaginationProps }
