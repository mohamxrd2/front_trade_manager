import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Carte standard du système de design Waelly (design/DESIGN.md § 7).
 * Blanc, rayon 22px, ombre carte.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="waelly-card"
      className={cn("rounded-card bg-surface shadow-card p-5", className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="waelly-card-header"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="waelly-card-title"
      className={cn("text-lg font-bold text-ink", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle }
