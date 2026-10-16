'use client'

import * as React from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

import { getStockHistory, type StockHistoryEntry } from '@/lib/services/articles'

dayjs.locale('fr')

interface StockHistoryListProps {
  articleId: string | number
  refreshKey?: number
  /** Masque le "· par {utilisateur}" (liste mobile, maquette Article.dc.html) */
  showUser?: boolean
}

const PER_PAGE = 50

// Reprend exactement Web-Article.dc.html : 1re pastille #5B3FE6, 2e #A58CFF,
// les suivantes #DCD4FF.
const DOT_COLORS = ['bg-brand-500', 'bg-brand-300', 'bg-chart-4']

/**
 * Historique des réapprovisionnements — liste à pastilles de
 * design/maquettes/ordinateur/Web-Article.dc.html § Historique.
 * Pagine jusqu'à épuisement pour afficher la totalité de l'historique,
 * pas uniquement la première page retournée par l'API.
 */
export function StockHistoryList({ articleId, refreshKey = 0, showUser = true }: StockHistoryListProps) {
  const [history, setHistory] = React.useState<StockHistoryEntry[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    const fetchAll = async () => {
      setIsLoading(true)
      try {
        let page = 1
        let all: StockHistoryEntry[] = []
        for (;;) {
          const data = await getStockHistory(articleId, { page, perPage: PER_PAGE })
          all = all.concat(data.history)
          if (!data.pagination || data.pagination.current_page >= data.pagination.last_page) break
          page += 1
        }
        if (!cancelled) {
          setHistory(all)
        }
      } catch {
        if (!cancelled) {
          setHistory([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [articleId, refreshKey])

  const formatUserName = (user: StockHistoryEntry['user']) =>
    user ? `${user.first_name} ${user.last_name}` : 'Utilisateur inconnu'

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[38px] animate-pulse rounded-lg bg-surface-soft" />
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return <p className="py-2 text-sm text-subtle">Aucun réapprovisionnement pour l&apos;instant</p>
  }

  return (
    <div className="flex flex-col">
      {history.map((entry, i) => (
        <div key={entry.id} className="flex gap-3 py-2">
          <span
            className={`mt-[5px] size-[10px] shrink-0 rounded-[5px] ${DOT_COLORS[Math.min(i, DOT_COLORS.length - 1)]}`}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">
              +{entry.quantity_added} pièce{entry.quantity_added > 1 ? 's' : ''}
              {entry.note ? ` · ${entry.note}` : ''}
            </span>
            <span className="text-xs text-subtle">
              {dayjs(entry.created_at).format('D MMM YYYY')}
              {showUser ? ` · par ${formatUserName(entry.user)}` : ''}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}
