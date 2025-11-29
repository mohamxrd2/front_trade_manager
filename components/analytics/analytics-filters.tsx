'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import type { PeriodType } from '@/lib/services/analytics'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

dayjs.locale('fr')

interface AnalyticsFiltersProps {
  period: PeriodType
  onPeriodChange: (period: PeriodType) => void
  startDate: Date | null
  onStartDateChange: (date: Date | null) => void
  endDate: Date | null
  onEndDateChange: (date: Date | null) => void
  loading?: boolean
}

export function AnalyticsFilters({
  period,
  onPeriodChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  loading = false,
}: AnalyticsFiltersProps) {
  const { t } = useTranslation()
  const [startCalendarOpen, setStartCalendarOpen] = useState(false)
  const [endCalendarOpen, setEndCalendarOpen] = useState(false)

  const periods: Array<{ value: PeriodType; label: string }> = [
    { value: 'today', label: t('common.today') },
    { value: '7', label: t('analytics.week') },
    { value: '30', label: t('analytics.month') },
    { value: 'year', label: t('analytics.year') },
    { value: 'all', label: t('analytics.all') },
    { value: 'custom', label: t('analytics.custom') },
  ]

  // Auto-apply quand les dates custom changent
  useEffect(() => {
    if (period === 'custom' && startDate && endDate) {
      // Les données se rechargeront automatiquement via les query keys
      // qui incluent startDate et endDate dans apiParams
    }
  }, [period, startDate, endDate])

  return (
    <div className="space-y-4">
      {/* Navigation des périodes */}
      <div className="flex flex-wrap items-center gap-2">
        {periods.map((p) => (
          <Button
            key={p.value}
            variant={period === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPeriodChange(p.value)}
            disabled={loading}
            className={cn(
              'transition-all',
              period === p.value && 'shadow-md'
            )}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Date pickers pour période personnalisée */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t('analytics.from')}:</span>
            <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-[160px] justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? dayjs(startDate).format('DD/MM/YYYY') : t('analytics.selectDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate || undefined}
                  onSelect={(date: Date | undefined) => {
                    onStartDateChange(date || null)
                    if (date) {
                      setStartCalendarOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t('analytics.to')}:</span>
            <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'w-[160px] justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? dayjs(endDate).format('DD/MM/YYYY') : t('analytics.selectDate')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate || undefined}
                  onSelect={(date: Date | undefined) => {
                    onEndDateChange(date || null)
                    if (date) {
                      setEndCalendarOpen(false)
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  )
}

