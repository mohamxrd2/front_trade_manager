import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Bouton du système de design Waelly (design/DESIGN.md § 7).
 * Distinct de components/ui/button.tsx (shadcn) pour ne pas affecter
 * les pages existantes pendant la migration progressive de l'interface.
 */
const waellyButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold text-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[18px] shrink-0 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-button text-white shadow-button hover:brightness-105",
        black: "bg-active text-white hover:bg-active/90",
        secondary:
          "bg-surface text-ink border border-line-strong hover:bg-surface-soft",
        danger: "bg-danger-bg text-danger-strong hover:brightness-95",
        glass: "glass text-ink hover:brightness-105",
        round: "bg-orb text-white shadow-button p-0",
      },
      size: {
        default: "h-12 px-6", // 48px — hauteur ordinateur
        lg: "h-[54px] px-6", // 54px — hauteur mobile
        round: "size-12 rounded-full", // 48px
        "round-lg": "size-[58px] rounded-full", // 58px
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof waellyButtonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="waelly-button"
      className={cn(waellyButtonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, waellyButtonVariants }
