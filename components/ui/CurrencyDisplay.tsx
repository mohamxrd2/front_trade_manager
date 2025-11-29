'use client'

import { useCurrency } from '@/lib/utils/currency'

interface CurrencyDisplayProps {
  amount: number | string
  className?: string
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  const { format } = useCurrency()

  return <span className={className}>{format(amount)}</span>
}

