'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { paymentMethodIcon, paymentMethodLabelKey } from '@/lib/transactions/transaction-visual'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import type { TransactionPaymentMethod } from '@/lib/services/transactions'

const PAYMENT_METHODS: TransactionPaymentMethod[] = [
  'especes',
  'orange_money',
  'moov_money',
  'wave',
  'mtn_money',
  'virement',
]

interface PaymentMethodChipsProps {
  value: TransactionPaymentMethod | ''
  onChange: (value: TransactionPaymentMethod) => void
  className?: string
}

/**
 * Grandes puces avec icône — moyen d'encaissement de la vente (étape 3 du
 * chantier "paniers multi-articles"). Distinctes de <FilterChips> (texte
 * seul, plus petites, utilisées par le formulaire Apport/Retrait) : le
 * cahier des charges demande explicitement une icône ici.
 */
function PaymentMethodChips({ value, onChange, className }: PaymentMethodChipsProps) {
  const { t } = useTranslation()

  return (
    <div role="group" aria-label={t('wallet.deposit.paymentMethodLabel')} className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3', className)}>
      {PAYMENT_METHODS.map((method) => {
        const active = method === value
        const Icon = paymentMethodIcon(method)
        const labelKey = paymentMethodLabelKey(method)
        return (
          <button
            key={method}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(method)}
            className={cn(
              'flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-tile px-3 py-3 text-center font-semibold transition-colors',
              active ? 'bg-ink text-white' : 'border border-line-strong bg-surface text-ink-2'
            )}
          >
            <Icon className="size-5" strokeWidth={2} />
            <span className="text-xs leading-tight">{labelKey ? t(labelKey) : method}</span>
          </button>
        )
      })}
    </div>
  )
}

export { PaymentMethodChips, PAYMENT_METHODS }
export type { PaymentMethodChipsProps }
