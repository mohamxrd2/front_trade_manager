import dayjs, { type Dayjs } from 'dayjs'

/**
 * Raccourcis du sélecteur de plage de dates (barre de recherche
 * Portefeuille) — pure, prend la date de référence en paramètre pour rester
 * testable de façon déterministe (jamais `dayjs()` sans argument à
 * l'intérieur).
 */
export type DateShortcut = 'today' | 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth'

export interface DateRange {
  from: string // AAAA-MM-JJ
  to: string // AAAA-MM-JJ
}

export function computeDateShortcutRange(shortcut: DateShortcut, referenceDate: Dayjs): DateRange {
  const fmt = (d: Dayjs) => d.format('YYYY-MM-DD')

  switch (shortcut) {
    case 'today':
      return { from: fmt(referenceDate), to: fmt(referenceDate) }
    case 'yesterday': {
      const yesterday = referenceDate.subtract(1, 'day')
      return { from: fmt(yesterday), to: fmt(yesterday) }
    }
    case 'last7days':
      return { from: fmt(referenceDate.subtract(6, 'day')), to: fmt(referenceDate) }
    case 'thisMonth':
      return { from: fmt(referenceDate.startOf('month')), to: fmt(referenceDate.endOf('month')) }
    case 'lastMonth': {
      const lastMonth = referenceDate.subtract(1, 'month')
      return { from: fmt(lastMonth.startOf('month')), to: fmt(lastMonth.endOf('month')) }
    }
  }
}

export function todayISO(referenceDate: Dayjs = dayjs()): string {
  return referenceDate.format('YYYY-MM-DD')
}
