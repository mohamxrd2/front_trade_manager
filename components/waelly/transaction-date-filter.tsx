'use client'

import * as React from 'react'
import dayjs from 'dayjs'
import { Calendar } from 'lucide-react'

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatDate } from '@/lib/i18n/format'
import { computeDateShortcutRange, type DateShortcut } from '@/lib/transactions/date-shortcuts'
import { Button } from './button'

export interface DateRangeValue {
  from: string | null // AAAA-MM-JJ
  to: string | null // AAAA-MM-JJ
  /** Étiquette lisible pour la puce de filtre actif, ex. "24 oct. 2026". */
  label: string | null
}

export interface TransactionDateFilterProps {
  /** 'popover' (ordinateur) ou 'drawer' (bottom sheet mobile). */
  variant: 'popover' | 'drawer'
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
}

const SHORTCUTS: DateShortcut[] = ['today', 'yesterday', 'last7days', 'thisMonth', 'lastMonth']

/**
 * Bouton "Filtrer" (icône calendrier) + sélecteur de plage de dates — bottom
 * sheet sur mobile, popover sur ordinateur (voir `variant`), avec des
 * raccourcis (Aujourd'hui, Hier, 7 derniers jours, Ce mois-ci, Mois
 * dernier) et une plage personnalisée.
 */
function TransactionDateFilter({ variant, value, onChange }: TransactionDateFilterProps) {
  const { t, language } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [customFrom, setCustomFrom] = React.useState(value.from ?? '')
  const [customTo, setCustomTo] = React.useState(value.to ?? '')

  React.useEffect(() => {
    if (open) {
      setCustomFrom(value.from ?? '')
      setCustomTo(value.to ?? '')
    }
  }, [open, value.from, value.to])

  const shortcutLabels: Record<DateShortcut, string> = {
    today: t('wallet.search.shortcutToday'),
    yesterday: t('wallet.search.shortcutYesterday'),
    last7days: t('wallet.search.shortcutLast7Days'),
    thisMonth: t('wallet.search.shortcutThisMonth'),
    lastMonth: t('wallet.search.shortcutLastMonth'),
  }

  const applyShortcut = (shortcut: DateShortcut) => {
    const range = computeDateShortcutRange(shortcut, dayjs())
    onChange({ from: range.from, to: range.to, label: shortcutLabels[shortcut] })
    setOpen(false)
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    const label =
      customFrom === customTo
        ? formatDate(customFrom, language, 'D MMM YYYY')
        : `${formatDate(customFrom, language, 'D MMM')} – ${formatDate(customTo, language, 'D MMM YYYY')}`
    onChange({ from: customFrom, to: customTo, label })
    setOpen(false)
  }

  const clear = () => {
    onChange({ from: null, to: null, label: null })
    setOpen(false)
  }

  const content = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut}
            type="button"
            onClick={() => applyShortcut(shortcut)}
            className="flex min-h-11 items-center rounded-tile px-3.5 text-left text-sm font-semibold text-ink hover:bg-surface-soft"
          >
            {shortcutLabels[shortcut]}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <span className="text-[13px] font-semibold text-ink">{t('wallet.search.customRangeLabel')}</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            aria-label={t('wallet.search.customRangeFrom')}
            className="h-11 min-w-0 flex-1 rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
          />
          <span className="text-subtle">–</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            aria-label={t('wallet.search.customRangeTo')}
            className="h-11 min-w-0 flex-1 rounded-field border border-line-strong bg-surface px-3 text-sm text-ink"
          />
        </div>
        <Button type="button" variant="primary" className="h-11" onClick={applyCustom} disabled={!customFrom || !customTo}>
          {t('wallet.search.applyCustomRange')}
        </Button>
        {value.from ? (
          <button type="button" onClick={clear} className="flex min-h-9 items-center justify-center text-sm font-semibold text-danger-strong">
            {t('wallet.search.clearDateFilter')}
          </button>
        ) : null}
      </div>
    </div>
  )

  const triggerClassName = `flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold lg:h-12 ${
    value.from ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line-strong bg-surface text-ink'
  }`

  if (variant === 'drawer') {
    return (
      <>
        <button type="button" aria-pressed={!!value.from} className={triggerClassName} onClick={() => setOpen(true)}>
          <Calendar className="size-[18px]" strokeWidth={2} />
          {t('wallet.search.filterButton')}
        </button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="px-5 pb-8 pt-2.5">
            <DrawerHeader className="mt-1.5">
              <DrawerTitle>{t('wallet.search.filterButton')}</DrawerTitle>
            </DrawerHeader>
            <div className="mt-3.5">{content}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-pressed={!!value.from} className={triggerClassName}>
          <Calendar className="size-[18px]" strokeWidth={2} />
          {t('wallet.search.filterButton')}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {content}
      </PopoverContent>
    </Popover>
  )
}

export { TransactionDateFilter }
