'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import type { TransactionPaymentMethod } from '@/lib/services/transactions'
import { suggestCashAmounts, computeChange } from '@/lib/wallet/cash-amounts'
import { Amount } from './amount'
import { PaymentMethodChips } from './payment-method-chips'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export interface CheckoutClientOption {
  id: string
  name: string
}

export interface CheckoutFieldsProps {
  total: number
  paymentMethod: TransactionPaymentMethod | ''
  onPaymentMethodChange: (method: TransactionPaymentMethod) => void
  /** `null` = montant exact (aucun billet touché, aucune saisie — comportement par défaut). */
  amountReceived: number | null
  onAmountReceivedChange: (amount: number | null) => void
  clientId: string
  onClientIdChange: (id: string) => void
  clients: CheckoutClientOption[]
  loadingClients: boolean
  note: string
  onNoteChange: (note: string) => void
}

/**
 * Champs de l'encaissement — moyen de paiement, espèces (boutons de billets
 * calculés automatiquement, jamais de saisie obligatoire), client facultatif,
 * note repliable. Rendu identique mobile (dans un Drawer, voir wallet/new/
 * page.tsx) et ordinateur (inline dans le panneau de droite) : UN SEUL
 * composant, deux coquilles — même principe que DepositWithdrawalSheet.
 */
function CheckoutFields({
  total,
  paymentMethod,
  onPaymentMethodChange,
  amountReceived,
  onAmountReceivedChange,
  clientId,
  onClientIdChange,
  clients,
  loadingClients,
  note,
  onNoteChange,
}: CheckoutFieldsProps) {
  const { t, language } = useTranslation()
  const [customOpen, setCustomOpen] = React.useState(false)
  const [customValue, setCustomValue] = React.useState('')
  const [noteOpen, setNoteOpen] = React.useState(false)

  const isCash = paymentMethod === 'especes'
  const suggestions = React.useMemo(() => suggestCashAmounts(total), [total])
  const changeGiven = amountReceived != null ? computeChange(amountReceived, total) : null

  // Changer de moyen de paiement (ou le total) invalide tout choix d'espèces précédent.
  React.useEffect(() => {
    if (!isCash && amountReceived != null) onAmountReceivedChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCash])

  const selectBill = (amount: number) => {
    if (amountReceived === amount) {
      onAmountReceivedChange(null)
    } else {
      onAmountReceivedChange(amount)
      setCustomOpen(false)
      setCustomValue('')
    }
  }

  const applyCustomAmount = () => {
    const parsed = parseFloat(customValue)
    if (!isNaN(parsed) && parsed >= 0) {
      onAmountReceivedChange(parsed)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-1 rounded-tile bg-surface-soft py-5 text-center">
        <span className="text-sm font-semibold text-subtle">{t('wallet.checkout.totalLabel')}</span>
        <span className="text-[32px] font-extrabold tracking-[-0.03em] text-ink">
          <Amount value={total} /> <span className="text-base text-subtle">F</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-ink">{t('wallet.deposit.paymentMethodLabel')}</span>
        <PaymentMethodChips value={paymentMethod} onChange={onPaymentMethodChange} />
      </div>

      {isCash ? (
        <div className="flex flex-col gap-2.5">
          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink">{t('wallet.checkout.billReceivedLabel')}</span>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((amount) => {
                  const active = amountReceived === amount
                  return (
                    <button
                      key={amount}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectBill(amount)}
                      className={`flex h-12 min-w-[88px] items-center justify-center rounded-full px-4 text-sm font-bold ${
                        active ? 'bg-ink text-white' : 'border border-line-strong bg-surface text-ink'
                      }`}
                    >
                      <Amount value={amount} /> F
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {customOpen ? (
            <div className="flex items-center gap-2 rounded-tile border border-line-strong px-3.5">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value.replace(/\D/g, ''))}
                onBlur={applyCustomAmount}
                placeholder="0"
                aria-label={t('wallet.checkout.customAmountLabel')}
                className="h-12 w-full min-w-0 bg-transparent text-base font-bold text-ink outline-none"
              />
              <span className="shrink-0 text-sm font-semibold text-subtle">F</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="self-start text-sm font-semibold text-brand-600"
            >
              {t('wallet.checkout.customAmountLink')}
            </button>
          )}

          {changeGiven != null ? (
            <p className="rounded-tile bg-success-bg px-4 py-3 text-base font-bold text-success-strong" role="status">
              {t('wallet.checkout.changeGiven', { amount: formatAmount(changeGiven, language) })}
            </p>
          ) : (
            <p className="text-xs text-subtle">{t('wallet.checkout.exactAmountHint')}</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="checkout-client" className="text-[13px] font-semibold text-ink">
          {t('wallet.checkout.clientLabel')}
        </label>
        <select
          id="checkout-client"
          value={clientId}
          onChange={(e) => onClientIdChange(e.target.value)}
          disabled={loadingClients}
          className="h-12 rounded-field border border-line-strong bg-surface px-3 text-sm text-ink disabled:opacity-60"
        >
          <option value="">{t('wallet.checkout.walkInClient')}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          aria-expanded={noteOpen}
          className="flex items-center justify-between text-[13px] font-semibold text-ink"
        >
          {t('wallet.checkout.noteLabel')}
          <ChevronDown className={`size-4 transition-transform ${noteOpen ? 'rotate-180' : ''}`} />
        </button>
        {noteOpen ? (
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={2}
            placeholder={t('wallet.checkout.notePlaceholder')}
            className="min-h-[60px] rounded-field border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink"
          />
        ) : null}
      </div>
    </div>
  )
}

export { CheckoutFields }
