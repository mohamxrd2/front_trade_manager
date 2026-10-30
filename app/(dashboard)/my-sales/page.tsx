'use client'

import * as React from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import { Plus, Printer } from 'lucide-react'

import { CashierReprintSheet } from '@/components/dashboard/cashier-reprint-sheet'
import { Amount, Button, Card } from '@/components/waelly'
import { Skeleton } from '@/components/ui/skeleton'
import { Can } from '@/components/Can'
import { useTransactionsQuery } from '@/lib/hooks/useTransactions'
import { groupTransactionsByOperation, operationGroupTitle, type OperationGroup } from '@/lib/transactions/group-by-operation'
import { paymentMethodMeta } from '@/lib/payments/methods'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'

/**
 * Chantier "Équipe" §6 — onglet « Mes ventes » d'un membre sans
 * wallet.view_balance (caissier). Le backend ne renvoie déjà que SES
 * opérations quand il n'a que sales.view_own (TransactionController) : on
 * se contente d'afficher les ventes, regroupées par jour, sans aucun solde.
 * Permission vérifiée par le layout (lib/permissions/route-permissions.ts).
 */
export default function MySalesPage() {
  const { t, language } = useTranslation()
  const { data, isPending, isError, refetch } = useTransactionsQuery()
  const [reprintId, setReprintId] = React.useState<string | null>(null)

  const days = React.useMemo(() => {
    const sales = groupTransactionsByOperation((data ?? []).filter((tx) => tx.type === 'sale'))
    const byDay = new Map<string, OperationGroup[]>()
    for (const group of sales) {
      const day = dayjs(group.date).format('YYYY-MM-DD')
      byDay.set(day, [...(byDay.get(day) ?? []), group])
    }
    return [...byDay.entries()]
  }, [data])

  const dayLabel = (day: string) => {
    const d = dayjs(day)
    if (d.isSame(dayjs(), 'day')) return t('wallet.today')
    if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return t('wallet.yesterday')
    return formatDate(day, language, 'D MMMM')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-ink lg:text-[28px]">{t('nav.mySales')}</h1>
        <Can permission="sales.create">
          <Button variant="primary" asChild>
            <Link href="/wallet/new?type=sale">
              <Plus className="size-4" strokeWidth={2.2} />
              {t('nav.newSale')}
            </Link>
          </Button>
        </Can>
      </div>

      {isPending && !data ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : isError && !data ? (
        <Card className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-subtle">{t('wallet.list.loadError')}</p>
          <Button variant="secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </Card>
      ) : days.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-subtle">{t('transactions.mySales.empty')}</p>
        </Card>
      ) : (
        days.map(([day, groups]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-subtle">{dayLabel(day)}</h2>
            <Card className="p-0">
              <div className="flex flex-col divide-y divide-divider">
                {groups.map((group) => {
                  const meta = paymentMethodMeta(group.paymentMethod)
                  const title = operationGroupTitle(group, t)
                  return (
                    <div key={group.operationId} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-bold text-ink">{title}</span>
                        <span className="text-xs text-subtle">
                          {[group.operationCode, formatDate(group.date, language, 'HH:mm'), t(meta.labelKey)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-ink">
                        <Amount value={group.amount} currency />
                      </span>
                      <button
                        type="button"
                        onClick={() => setReprintId(group.operationId)}
                        aria-label={t('dashboard.cashier.reprintAria', { code: group.operationCode ?? title })}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2"
                      >
                        <Printer className="size-4" strokeWidth={1.9} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </Card>
          </section>
        ))
      )}

      <CashierReprintSheet operationId={reprintId} onOpenChange={(open) => !open && setReprintId(null)} />
    </div>
  )
}
