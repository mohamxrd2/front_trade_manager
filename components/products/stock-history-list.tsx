'use client'

import { useEffect, useState } from 'react'
import { History, Package, Calendar, TrendingUp, User } from 'lucide-react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('fr')

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  getStockHistory, 
  type StockHistoryEntry, 
  type StockHistorySummary 
} from '@/lib/services/articles'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

// ============================================================================
// PROPS
// ============================================================================

interface StockHistoryListProps {
  articleId: string | number
  refreshKey?: number // Permet de forcer le rafraîchissement
}

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function StockHistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StockHistoryList({ articleId, refreshKey = 0 }: StockHistoryListProps) {
  const { t } = useTranslation()
  const [history, setHistory] = useState<StockHistoryEntry[]>([])
  const [summary, setSummary] = useState<StockHistorySummary>({ 
    total_replenished: 0, 
    replenishment_count: 0 
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Flag pour éviter les race conditions
    let isCancelled = false

    const fetchHistory = async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('📦 StockHistoryList: Fetching history...', { articleId, refreshKey })
      }

      setIsLoading(true)
      try {
        const data = await getStockHistory(articleId)
        
        // Ne pas mettre à jour si le composant a été démonté
        if (!isCancelled) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('✅ StockHistoryList: History loaded', { 
              entries: data.history.length,
              totalReplenished: data.summary.total_replenished,
              refreshKey 
            })
          }
          setHistory(data.history)
          setSummary(data.summary)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('❌ Erreur lors du chargement de l\'historique:', error)
          setHistory([])
          setSummary({ total_replenished: 0, replenishment_count: 0 })
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchHistory()

    // Cleanup function
    return () => {
      isCancelled = true
    }
  }, [articleId, refreshKey])

  // Formater la date
  const formatDate = (dateString: string) => {
    const date = dayjs(dateString)
    return {
      date: date.format('DD MMM YYYY'),
      time: date.format('HH:mm'),
      relative: date.fromNow(),
    }
  }

  // Formater le nom de l'utilisateur
  const formatUserName = (user: StockHistoryEntry['user']) => {
    if (!user) return 'Utilisateur inconnu'
    return `${user.first_name} ${user.last_name}`
  }

  return (
    <Card className="max-h-[450px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            {t('products.stockHistory')}
          </CardTitle>
          {!isLoading && history.length > 0 && (
            <Badge variant="secondary" className="font-normal">
              {summary.replenishment_count} {t('products.restockEntries')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <StockHistorySkeleton />
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              {t('products.noStockHistory')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full space-y-4">
            {/* Résumé avec le total du backend - fixe en haut */}
            <div className="flex-shrink-0 flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  {t('products.totalStockAdded')}
                </span>
              </div>
              <span className="font-bold text-green-700 dark:text-green-400">
                +{summary.total_replenished} {t('common.units')}
              </span>
            </div>

            {/* Liste des entrées - scrollable */}
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2">
                {history.map((entry) => {
                  const { date, time } = formatDate(entry.created_at)
                  
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {t('products.restockEntry')}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{date}</span>
                            <span className="text-muted-foreground/50">•</span>
                            <span>{time}</span>
                          </div>
                          {/* Afficher l'utilisateur */}
                          {entry.user && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                              <User className="h-3 w-3" />
                              <span>{formatUserName(entry.user)}</span>
                            </div>
                          )}
                          {/* Afficher la note si présente */}
                          {entry.note && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              &ldquo;{entry.note}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="border-green-500 text-green-700 dark:text-green-400 font-semibold"
                      >
                        +{entry.quantity_added}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
