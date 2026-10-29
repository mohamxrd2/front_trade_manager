'use client'

import * as React from 'react'
import Link from 'next/link'
import { Bell, Plus, Printer, Settings } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'
import type { MyDay } from '@/lib/auth'
import { paymentMethodMeta } from '@/lib/payments/methods'
import { Amount, Button, Card, CardHeader, CardTitle } from '@/components/waelly'
import { CashierReprintSheet } from '@/components/dashboard/cashier-reprint-sheet'

/**
 * Chantier "Équipe" §6 — accueil d'un membre sans wallet.view_balance (ex.
 * caissier) : sa caisse du jour UNIQUEMENT, jamais le solde/CA/bénéfice/part
 * globaux de l'entreprise. Données déjà calculées côté backend
 * (GET /api/user → user.my_day, voir AuthController::myDay()).
 */
function CashierDashboard({ myDay }: { myDay: MyDay }) {
  const { user } = useAuth()
  const { t, language } = useTranslation()
  const { unreadCount } = useNotifications()
  const [reprintId, setReprintId] = React.useState<string | null>(null)

  const notificationsAriaLabel = t('dashboard.notificationsAria', { count: unreadCount })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-subtle">{t('dashboard.greeting', { name: user?.first_name ?? '' })}</span>
          <h1 className="text-[22px] font-bold tracking-tight text-ink lg:text-[28px]">{t('dashboard.cashier.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label={t('nav.settings')}
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <Settings className="size-[20px]" strokeWidth={1.8} />
          </Link>
          <Link
            href="/notifications"
            aria-label={notificationsAriaLabel}
            className="relative flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <Bell className="size-[20px]" strokeWidth={1.8} />
            {unreadCount > 0 ? (
              <span className="absolute right-2.5 top-2.5 size-[9px] rounded-full border-2 border-surface bg-danger-dot" />
            ) : null}
          </Link>
        </div>
      </div>

      <Button variant="primary" asChild className="h-14 w-full text-base">
        <Link href="/wallet/new?type=sale">
          <Plus className="size-5" strokeWidth={2.2} />
          {t('nav.newSale')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.cashier.todaySales')}</CardTitle>
        </CardHeader>
        <div className="mt-3 flex items-baseline gap-2.5">
          <span className="text-[30px] font-extrabold text-ink">
            <Amount value={myDay.total} currency />
          </span>
          <span className="text-sm text-subtle">{t('team.salesCount', { count: myDay.sales_count })}</span>
        </div>

        {myDay.by_payment_method.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2 border-t border-divider pt-4">
            <span className="text-xs font-bold uppercase tracking-wide text-subtle">{t('dashboard.cashier.byPaymentMethod')}</span>
            {myDay.by_payment_method.map((row) => {
              const meta = paymentMethodMeta(row.payment_method)
              const Icon = meta.Icon
              return (
                <div key={row.payment_method} className="flex items-center gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
                  >
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink">{t(meta.labelKey)}</span>
                  <span className="text-xs text-subtle">{t('team.salesCount', { count: row.count })}</span>
                  <span className="text-sm font-bold text-ink">
                    <Amount value={row.amount} currency />
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}
      </Card>

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardTitle>{t('dashboard.cashier.recentSales')}</CardTitle>
        </div>
        {myDay.last_sales.length === 0 ? (
          <p className="p-5 text-center text-sm text-subtle">{t('dashboard.cashier.noSalesYet')}</p>
        ) : (
          <div className="mt-3 flex flex-col divide-y divide-divider">
            {myDay.last_sales.map((sale) => {
              const meta = paymentMethodMeta(sale.payment_method)
              return (
                <div key={sale.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold text-ink">{sale.code}</span>
                    <span className="text-xs text-subtle">
                      {formatDate(sale.occurred_at, language, 'HH:mm')} · {t(meta.labelKey)}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-ink">
                    <Amount value={sale.total_amount} currency />
                  </span>
                  <button
                    type="button"
                    onClick={() => setReprintId(sale.id)}
                    aria-label={t('dashboard.cashier.reprintAria', { code: sale.code })}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2"
                  >
                    <Printer className="size-4" strokeWidth={1.9} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <CashierReprintSheet operationId={reprintId} onOpenChange={(open) => !open && setReprintId(null)} />
    </div>
  )
}

export { CashierDashboard }
