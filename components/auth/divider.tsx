import { cn } from '@/lib/utils'

interface DividerProps {
  children: React.ReactNode
  className?: string
}

/** Séparateur "ou avec votre e-mail" commun aux 3 pages d'auth. */
export function Divider({ children, className }: DividerProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-[#E2E2EA]" />
      <span className="shrink-0 text-[13px] text-[#6B6B7B]">{children}</span>
      <span className="h-px flex-1 bg-[#E2E2EA]" />
    </div>
  )
}
