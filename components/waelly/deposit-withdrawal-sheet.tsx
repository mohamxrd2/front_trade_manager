'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { keys } from '@/lib/query-keys'
import { getCollaborators } from '@/lib/services/collaborators'
import {
  createDeposit,
  createWithdrawal,
  TransactionValidationError,
  type Transaction,
  type DepositFundingSource,
  type TransactionPaymentMethod,
} from '@/lib/services/transactions'
import { isSilentError } from '@/lib/utils/error-handler'
import { fundingSourceLabelKey, paymentMethodLabelKey } from '@/lib/transactions/transaction-visual'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { Button, FilterChips } from '@/components/waelly'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'

const formatAmount = (value: number, language: AppLanguage): string =>
  formatNumber(value, language, { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const FUNDING_SOURCES: DepositFundingSource[] = ['apport_personnel', 'collaborateur', 'pret', 'autre']
const PAYMENT_METHODS: TransactionPaymentMethod[] = [
  'especes',
  'orange_money',
  'moov_money',
  'wave',
  'mtn_money',
  'virement',
]

function nowForInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export interface DepositWithdrawalSheetProps {
  /** 'apport' | 'retrait' | null (fermé). */
  mode: 'apport' | 'retrait' | null
  onOpenChange: (open: boolean) => void
  /** Solde actuel (toutes périodes) — pour l'avertissement de retrait à découvert. */
  currentBalance: number
  onCreated: (transaction: Transaction) => void
  /** 'drawer' = bottom sheet mobile (vaul), 'dialog' = modale centrée ordinateur — deux instances séparées (états distincts côté appelant), jamais partagées, pour ne pas ouvrir les deux à la fois (voir wallet/page.tsx). */
  variant: 'drawer' | 'dialog'
}

/**
 * Formulaire Apport de fonds / Retrait — maquette "Ajouter un collaborateur"
 * (bottom sheet mobile) + modale centrée ordinateur. Un seul composant, deux
 * coquilles (Drawer/Dialog) autour des mêmes champs, voir `variant`.
 */
function DepositWithdrawalSheet({ mode, onOpenChange, currentBalance, onCreated, variant }: DepositWithdrawalSheetProps) {
  const { t, language } = useTranslation()
  const isDeposit = mode === 'apport'
  const open = mode !== null

  const [amount, setAmount] = React.useState('')
  const [fundingSource, setFundingSource] = React.useState<DepositFundingSource | ''>('')
  const [collaboratorId, setCollaboratorId] = React.useState('')
  const [paymentMethod, setPaymentMethod] = React.useState<TransactionPaymentMethod | ''>('')
  const [date, setDate] = React.useState(() => nowForInput())
  const [note, setNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [overdraftWarned, setOverdraftWarned] = React.useState(false)

  const resetForm = React.useCallback(() => {
    setAmount('')
    setFundingSource('')
    setCollaboratorId('')
    setPaymentMethod('')
    setDate(nowForInput())
    setNote('')
    setOverdraftWarned(false)
  }, [])

  // Réinitialise à CHAQUE ouverture (pas à la fermeture) : si l'utilisateur
  // rouvre juste après un envoi réussi, le formulaire doit être vierge, pas
  // garder les valeurs de l'apport précédent.
  const prevOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (open && !prevOpenRef.current) resetForm()
    prevOpenRef.current = open
  }, [open, resetForm])

  const { data: collaborators = [] } = useQuery({
    queryKey: keys.collaborators.all,
    queryFn: getCollaborators,
    enabled: isDeposit && open,
  })

  const amountNum = parseFloat(amount)
  const wouldGoNegative = !isDeposit && !isNaN(amountNum) && amountNum > currentBalance

  const fundingSourceOptions = FUNDING_SOURCES.map((value) => ({
    value,
    label: t(fundingSourceLabelKey(value) ?? 'transactions.operation'),
  }))

  const paymentMethodOptions = PAYMENT_METHODS.map((value) => ({
    value,
    label: t(paymentMethodLabelKey(value) ?? 'transactions.operation'),
  }))

  const handleSubmit = async () => {
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error(t('wallet.deposit.validation.amountPositive'))
      return
    }
    if (!paymentMethod) {
      toast.error(t('wallet.deposit.validation.paymentMethodRequired'))
      return
    }
    if (isDeposit) {
      if (!fundingSource) {
        toast.error(t('wallet.deposit.validation.fundingSourceRequired'))
        return
      }
      if (fundingSource === 'collaborateur' && !collaboratorId) {
        toast.error(t('wallet.deposit.validation.collaboratorRequired'))
        return
      }
    }
    if (wouldGoNegative && !overdraftWarned) {
      // Premier clic : affiche l'avertissement sans soumettre — le bouton
      // devient "Confirmer le retrait" (voir rendu ci-dessous), second clic
      // pour réellement envoyer. Pas de blocage dur (le solde peut devenir
      // négatif), juste une confirmation explicite.
      setOverdraftWarned(true)
      return
    }

    setSubmitting(true)
    const idempotencyKey = crypto.randomUUID()
    const isoDate = date ? new Date(date).toISOString() : undefined

    try {
      const created = isDeposit
        ? await createDeposit(
            {
              amount: amountNum,
              funding_source: fundingSource as DepositFundingSource,
              collaborator_id: fundingSource === 'collaborateur' ? collaboratorId : undefined,
              payment_method: paymentMethod as TransactionPaymentMethod,
              note: note.trim() || undefined,
              date: isoDate,
            },
            idempotencyKey
          )
        : await createWithdrawal(
            {
              amount: amountNum,
              payment_method: paymentMethod as TransactionPaymentMethod,
              note: note.trim() || undefined,
              date: isoDate,
            },
            idempotencyKey
          )

      toast.success(
        t(isDeposit ? 'wallet.deposit.successDeposit' : 'wallet.deposit.successWithdrawal', {
          amount: formatAmount(amountNum, language),
        })
      )
      onCreated(created)
      onOpenChange(false)
    } catch (error) {
      if (isSilentError(error)) return
      if (error instanceof TransactionValidationError) {
        toast.error(error.message)
      } else {
        toast.error(error instanceof Error ? error.message : t('wallet.deposit.errorGeneric'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const title = isDeposit ? t('wallet.deposit.titleDeposit') : t('wallet.deposit.titleWithdrawal')
  const saveLabel = wouldGoNegative && !overdraftWarned
    ? t('wallet.deposit.confirmOverdraft')
    : isDeposit
      ? t('wallet.deposit.saveDeposit')
      : t('wallet.deposit.saveWithdrawal')

  const fields = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${variant}-deposit-amount`} className="text-[13px] font-semibold text-ink">
          {t('wallet.deposit.amountLabel')}
        </label>
        <div className="flex items-center gap-2 rounded-tile border border-line-strong px-4">
          <input
            id={`${variant}-deposit-amount`}
            inputMode="numeric"
            placeholder="0"
            value={amount ? formatAmount(Number(amount), language) : ''}
            onChange={(e) => {
              setAmount(e.target.value.replace(/\D/g, ''))
              setOverdraftWarned(false)
            }}
            className="h-[60px] w-full min-w-0 bg-transparent text-[28px] font-extrabold text-ink outline-none"
          />
          <span className="shrink-0 text-base font-semibold text-subtle">F</span>
        </div>
        {wouldGoNegative ? (
          <p role="alert" className="rounded-tile bg-warning-bg px-3.5 py-2.5 text-[13px] font-semibold text-warning">
            {t('wallet.deposit.overdraftWarning', { amount: formatAmount(amountNum - currentBalance, language) })}
          </p>
        ) : null}
      </div>

      {isDeposit ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink">{t('wallet.deposit.fundingSourceLabel')}</span>
          <FilterChips
            options={fundingSourceOptions}
            value={fundingSource}
            onChange={(v) => setFundingSource(v as DepositFundingSource)}
          />
        </div>
      ) : null}

      {isDeposit && fundingSource === 'collaborateur' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${variant}-deposit-collaborator`} className="text-[13px] font-semibold text-ink">
            {t('wallet.deposit.collaboratorLabel')}
          </label>
          <select
            id={`${variant}-deposit-collaborator`}
            value={collaboratorId}
            onChange={(e) => setCollaboratorId(e.target.value)}
            className="h-12 rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
          >
            <option value="">{t('wallet.deposit.chooseCollaboratorOption')}</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink">{t('wallet.deposit.paymentMethodLabel')}</span>
        <FilterChips
          options={paymentMethodOptions}
          value={paymentMethod}
          onChange={(v) => setPaymentMethod(v as TransactionPaymentMethod)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${variant}-deposit-date`} className="text-[13px] font-semibold text-ink">
          {t('wallet.deposit.dateLabel')}
        </label>
        <input
          id={`${variant}-deposit-date`}
          type="datetime-local"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${variant}-deposit-note`} className="text-[13px] font-semibold text-ink">
          {t('wallet.deposit.noteLabel')}
        </label>
        <textarea
          id={`${variant}-deposit-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={t('wallet.deposit.notePlaceholder')}
          className="min-h-[60px] rounded-field border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink"
        />
      </div>

      <Button type="button" variant="primary" className="h-[54px] w-full text-base" onClick={handleSubmit} disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {saveLabel}
      </Button>
    </div>
  )

  if (variant === 'drawer') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-5 pb-8 pt-2.5">
          <DrawerHeader className="mt-1.5">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="mt-3.5">{fields}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-[rgba(14,14,26,0.42)] backdrop-blur-[4px]" />
        <DialogContent className="max-h-[90vh] w-[calc(100%-2.5rem)] max-w-[480px] overflow-y-auto rounded-[26px] border-none bg-surface p-6 shadow-[0_40px_90px_rgba(10,10,60,0.35)]">
          <DialogTitle className="text-lg font-bold text-ink">{title}</DialogTitle>
          {fields}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

export { DepositWithdrawalSheet }
