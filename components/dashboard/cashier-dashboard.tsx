'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Bell, FileText, Package, Plus, Printer, Settings } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { usePermissions } from '@/hooks/usePermissions'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'
import { useCurrency } from '@/lib/utils/currency'
import { keys } from '@/lib/query-keys'
import { getMyDay } from '@/lib/services/me'
import type { MyDay } from '@/lib/auth'
import { paymentMethodMeta } from '@/lib/payments/methods'
import { Amount, AmountVisibilityToggle, Button, Card, CardTitle, HeroCard, KpiCard } from '@/components/waelly'
import { CashierReprintSheet } from '@/components/dashboard/cashier-reprint-sheet'

/**
 * Chantier "Équipe" §6 — accueil d'un membre sans wallet.view_balance (ex.
 * caissier), même présentation que le tableau de bord du gérant (en-têtes,
 * carte héros, indicateurs, actions rapides) mais avec SA caisse du jour
 * uniquement : son solde du jour (encaissé − dépensé), jamais le solde, le
 * CA, le bénéfice ni les parts de l'entreprise. Données calculées côté
 * backend (GET /api/user → my_day), rechargées après chaque vente/dépense
 * (keys.userStats.myDay, invalidé par invalidateAfterOperation()).
 */
function CashierDashboard({ myDay: initialMyDay }: { myDay: MyDay }) {
  const { user } = useAuth()
  const { can } = usePermissions()
  const { t, language } = useTranslation()
  const { currency } = useCurrency()
  const { unreadCount } = useNotifications()
  const [reprintId, setReprintId] = React.useState<string | null>(null)

  const { data } = useQuery({
    queryKey: keys.userStats.myDay(),
    queryFn: getMyDay,
    initialData: initialMyDay,
    // Toujours frais au retour sur l'accueil (ex. après une vente).
    initialDataUpdatedAt: 0,
    refetchOnMount: 'always',
  })
  const myDay = data ?? initialMyDay

  const canSell = can('sales.create')
  const canExpense = can('expenses.create')
  const canViewStock = can('stock.view')

  const expensesTotal = myDay.expenses_total ?? 0
  const balance = myDay.balance ?? myDay.total - expensesTotal
  const averageBasket = myDay.sales_count > 0 ? myDay.total / myDay.sales_count : 0
  const topPayment = [...myDay.by_payment_method].sort((a, b) => b.amount - a.amount)[0]

  const todayLabel = formatDate(new Date().toISOString(), language, language === 'en' ? 'dddd, MMMM D' : 'dddd D MMMM')
  const initials = user ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() : '?'
  const notificationsAriaLabel = t('dashboard.notificationsAria', { count: unreadCount })

  const heroActions =
    canSell || canExpense ? (
      <>
        {canSell ? (
          <Button variant="secondary" className="flex-1" asChild>
            <Link href="/wallet/new?type=sale">
              <ArrowUpRight className="size-[17px]" />
              {t('common.sale')}
            </Link>
          </Button>
        ) : null}
        {canExpense ? (
          <Button variant="secondary" className="flex-1" asChild>
            <Link href="/wallet/new?type=expense">
              <ArrowDownLeft className="size-[17px]" />
              {t('common.expense')}
            </Link>
          </Button>
        ) : null}
      </>
    ) : undefined

  const kpiCards = [
    { label: t('dashboard.cashier.kpiSalesCount'), value: t('team.salesCount', { count: myDay.sales_count }), showArrow: false },
    { label: t('dashboard.cashier.kpiAverageBasket'), value: <Amount value={averageBasket} currency />, showArrow: false },
    {
      label: t('dashboard.cashier.kpiExpenses'),
      value: <Amount value={expensesTotal} currency />,
      showArrow: false,
    },
    {
      label: t('dashboard.cashier.kpiTopPayment'),
      value: topPayment ? t(paymentMethodMeta(topPayment.payment_method).labelKey) : t('dashboard.cashier.none'),
      showArrow: false,
    },
  ]

  const quickActions = [
    canSell ? { href: '/wallet/new?type=sale', label: t('common.sale'), icon: Plus, primary: true } : null,
    canExpense ? { href: '/wallet/new?type=expense', label: t('common.expense'), icon: ArrowDownLeft, primary: false } : null,
    { href: '/wallet', label: t('dashboard.cashier.mySales'), icon: FileText, primary: false },
    canViewStock ? { href: '/products', label: t('nav.stock'), icon: Package, primary: false } : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null)

  return (
    <div className="flex flex-col gap-5">
      {/* --- En-tête mobile (< 1024px) — même disposition que le gérant --- */}
      <div className="flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            aria-label={t('nav.settings')}
            className="flex size-11 items-center justify-center rounded-full bg-brand-500 text-[15px] font-bold text-white"
          >
            {initials}
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-subtle">{t('dashboard.greeting', { name: user?.first_name ?? '' })}</span>
            <span className="text-lg font-bold text-ink">{t('dashboard.cashier.title')}</span>
          </div>
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
            <Bell className="size-[22px]" strokeWidth={1.8} />
            {unreadCount > 0 ? (
              <span className="absolute right-2.5 top-2.5 size-[9px] rounded-full border-2 border-surface bg-danger-dot" />
            ) : null}
          </Link>
        </div>
      </div>

      {/* --- En-tête ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-wrap items-center justify-between gap-3.5 lg:flex">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('dashboard.greeting', { name: user?.first_name ?? '' })}</h1>
          <span className="text-sm text-subtle">{t('dashboard.cashier.summary', { date: todayLabel })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <AmountVisibilityToggle variant="glass" />
          <Link
            href="/notifications"
            aria-label={notificationsAriaLabel}
            className="glass relative flex size-12 items-center justify-center rounded-full text-ink"
          >
            <Bell className="size-5" strokeWidth={1.8} />
            {unreadCount > 0 ? <span className="absolute right-3.5 top-3 size-2 rounded-full bg-danger-dot" /> : null}
          </Link>
          {canSell ? (
            <Button variant="primary" asChild>
              <Link href="/wallet/new?type=sale">
                <Plus className="size-[18px]" strokeWidth={2.2} />
                {t('nav.newSale')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* --- Héros (solde du jour) + indicateurs --- */}
      <div className="flex flex-wrap gap-5">
        <div className="flex-[2_1_400px]">
          <HeroCard
            label={t('dashboard.cashier.dayBalance')}
            period={t('common.today')}
            eyeButton={<AmountVisibilityToggle variant="hero" />}
            amount={<Amount value={balance} />}
            currency={currency}
            stats={[
              { label: t('common.sales'), value: <>+<Amount value={myDay.total} /></> },
              { label: t('common.expenses'), value: <>−<Amount value={expensesTotal} /></> },
            ]}
            actions={heroActions}
          />
        </div>
        <div className="hidden flex-[3_1_460px] lg:grid lg:grid-cols-2 lg:gap-3.5">
          {kpiCards.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>

      {/* --- Actions rapides (mobile) --- */}
      <div className="grid grid-cols-4 gap-2.5 lg:hidden">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.href} href={action.href} className="flex flex-col items-center gap-2 text-xs font-semibold text-ink">
              <span
                className={
                  action.primary
                    ? 'flex size-14 items-center justify-center rounded-tile bg-orb text-white'
                    : 'flex size-14 items-center justify-center rounded-tile border border-line bg-surface'
                }
              >
                <Icon className="size-6" strokeWidth={1.9} />
              </span>
              {action.label}
            </Link>
          )
        })}
      </div>

      {/* --- Indicateurs (mobile, 2×2) --- */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        {kpiCards.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {/* --- Par moyen de paiement --- */}
        <Card className="flex-[2_1_320px]">
          <CardTitle>{t('dashboard.cashier.byPaymentMethod')}</CardTitle>
          {myDay.by_payment_method.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">{t('dashboard.cashier.noSalesYet')}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
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
          )}
        </Card>

        {/* --- Ses dernières ventes --- */}
        <Card className="flex-[3_1_420px] p-0">
          <div className="flex items-center justify-between p-5 pb-0">
            <CardTitle>{t('dashboard.cashier.recentSales')}</CardTitle>
            <Link href="/wallet" className="text-sm font-semibold text-brand-600">
              {t('dashboard.cashier.mySales')}
            </Link>
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
      </div>

      <CashierReprintSheet operationId={reprintId} onOpenChange={(open) => !open && setReprintId(null)} />
    </div>
  )
}

export { CashierDashboard }
