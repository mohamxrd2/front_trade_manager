'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

export type DateFilterType = 'today' | '7days' | '30days' | 'custom' | 'all'

interface StatsFiltersProps {
  dateFilter: DateFilterType
  onDateFilterChange: (filter: DateFilterType) => void
  customDateRange: {
    start: Date | null
    end: Date | null
  }
  onCustomDateRangeChange: (range: { start: Date | null; end: Date | null }) => void
  typeFilter: 'all' | 'sale' | 'expense'
  onTypeFilterChange: (filter: 'all' | 'sale' | 'expense') => void
}

export function StatsFilters({
  dateFilter,
  onDateFilterChange,
  customDateRange,
  onCustomDateRangeChange,
  typeFilter,
  onTypeFilterChange,
}: StatsFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false)

  const handlePresetDate = (preset: DateFilterType) => {
    onDateFilterChange(preset)
    if (preset !== 'custom') {
      onCustomDateRangeChange({ start: null, end: null })
    }
  }

  const getDateRange = (): { start: Date | null; end: Date | null } => {
    const today = dayjs().endOf('day').toDate()
    
    switch (dateFilter) {
      case 'today':
        return {
          start: dayjs().startOf('day').toDate(),
          end: today,
        }
      case '7days':
        return {
          start: dayjs().subtract(7, 'days').startOf('day').toDate(),
          end: today,
        }
      case '30days':
        return {
          start: dayjs().subtract(30, 'days').startOf('day').toDate(),
          end: today,
        }
      case 'custom':
        return customDateRange
      default:
        return { start: null, end: null }
    }
  }

  const dateRange = getDateRange()

  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Filtre date */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Période:</span>
            <Select value={dateFilter} onValueChange={handlePresetDate}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                <SelectItem value="7days">7 derniers jours</SelectItem>
                <SelectItem value="30days">30 derniers jours</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[280px] justify-start text-left font-normal',
                      !dateRange.start && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.start ? (
                      dateRange.end ? (
                        <>
                          {dayjs(dateRange.start).format('DD/MM/YYYY')} -{' '}
                          {dayjs(dateRange.end).format('DD/MM/YYYY')}
                        </>
                      ) : (
                        dayjs(dateRange.start).format('DD/MM/YYYY')
                      )
                    ) : (
                      <span>Sélectionner une date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={
                      dateRange.start && dateRange.end
                        ? {
                            from: dateRange.start,
                            to: dateRange.end,
                          }
                        : dateRange.start
                        ? {
                            from: dateRange.start,
                            to: undefined,
                          }
                        : undefined
                    }
                    onSelect={(range: { from?: Date; to?: Date } | Date | undefined) => {
                      if (!range) {
                        onCustomDateRangeChange({ start: null, end: null })
                        return
                      }
                      
                      if (range instanceof Date) {
                        onCustomDateRangeChange({
                          start: range,
                          end: null,
                        })
                      } else if (typeof range === 'object' && 'from' in range) {
                        onCustomDateRangeChange({
                          start: range.from || null,
                          end: range.to || null,
                        })
                        if (range.from && range.to) {
                          setCalendarOpen(false)
                        }
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Filtre type */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Type:</span>
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="sale">Ventes</SelectItem>
                <SelectItem value="expense">Dépenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

