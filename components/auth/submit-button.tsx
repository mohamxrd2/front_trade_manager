import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SubmitButtonProps {
  isSubmitting: boolean
  idleLabel: string
  busyLabel: string
  className?: string
}

/**
 * Bouton d'envoi commun aux 3 pages d'auth — dégradé radial brand,
 * ombre différente mobile/ordinateur (design/maquettes), vrai
 * <button type="submit"> (les <a> de la maquette ne sont que des liens de
 * démonstration).
 */
export function SubmitButton({ isSubmitting, idleLabel, busyLabel, className }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
      className={cn(
        'flex h-[54px] items-center justify-center gap-2 rounded-full text-[16px] font-bold text-white transition-[filter] disabled:cursor-not-allowed disabled:opacity-80',
        'bg-[radial-gradient(100%_140%_at_20%_0%,#8C74FF_0%,#5B3FE6_50%,#3420B8_100%)]',
        'shadow-[0_8px_20px_rgba(75,47,214,0.3)] md:shadow-[0_10px_24px_rgba(75,47,214,0.32)]',
        'enabled:hover:brightness-105',
        className
      )}
    >
      {isSubmitting ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
      {isSubmitting ? busyLabel : idleLabel}
    </button>
  )
}
