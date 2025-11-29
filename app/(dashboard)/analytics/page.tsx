'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import {
  getAnalyticsOverview,
  getAnalyticsTrends,
  getCategoryAnalysis,
  getComparisons,
  getKPIs,
  getPredictions,
  type PeriodType,
  type AnalyticsParams,
} from '@/lib/services/analytics'
import { AnalyticsFilters } from '@/components/analytics/analytics-filters'
import { OverviewCards } from '@/components/analytics/overview-cards'
import { TrendsCharts } from '@/components/analytics/trends-charts'
import { CategoryCharts } from '@/components/analytics/category-charts'
import { KPICards } from '@/components/analytics/kpi-cards'
import { PredictionsTable } from '@/components/analytics/predictions-table'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import dayjs from 'dayjs'

/**
 * Page Analytics - Vue complète des statistiques et analyses
 */
export default function AnalyticsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [dataUserId, setDataUserId] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // États pour les filtres
  const [period, setPeriod] = useState<PeriodType>('today')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Construire les paramètres API
  const buildParams = (): AnalyticsParams => {
    const params: AnalyticsParams = {
      period,
    }

    if (period === 'custom' && startDate && endDate) {
      params.start_date = dayjs(startDate).format('YYYY-MM-DD')
      params.end_date = dayjs(endDate).format('YYYY-MM-DD')
    }

    return params
  }

  const apiParams = buildParams()

  // Requêtes TanStack Query avec cache optimisé pour "Depuis toujours"
  // Pour "today", on veut un rafraîchissement immédiat, donc staleTime = 0
  const staleTime = period === 'all' ? 5 * 60 * 1000 : period === 'today' ? 0 : 1 * 60 * 1000
  
  const {
    data: overview,
    isLoading: isLoadingOverview,
    error: overviewError,
  } = useQuery({
    queryKey: ['analytics-overview', apiParams, refreshKey],
    queryFn: () => getAnalyticsOverview(apiParams),
    staleTime,
    refetchOnWindowFocus: period === 'today', // Refetch automatique pour "today"
  })

  const {
    data: trends,
    isLoading: isLoadingTrends,
    error: trendsError,
  } = useQuery({
    queryKey: ['analytics-trends', apiParams, refreshKey],
    queryFn: () => getAnalyticsTrends({ ...apiParams, type: 'both' }),
    staleTime,
    refetchOnWindowFocus: period === 'today',
  })

  const {
    data: categoryAnalysis,
    isLoading: isLoadingCategory,
    error: categoryError,
  } = useQuery({
    queryKey: ['analytics-category', apiParams, refreshKey],
    queryFn: () => getCategoryAnalysis(apiParams),
    staleTime,
    refetchOnWindowFocus: period === 'today',
  })

  // Désactiver comparisons pour "Depuis toujours" (non pertinent)
  const {
    data: comparisons,
    isLoading: isLoadingComparisons,
    error: comparisonsError,
  } = useQuery({
    queryKey: ['analytics-comparisons', apiParams, refreshKey],
    queryFn: () => {
      console.log('🔄 Chargement des comparaisons pour période:', period, apiParams)
      return getComparisons(apiParams)
    },
    enabled: period !== 'all', // Désactiver pour "Depuis toujours"
    staleTime: period === 'year' ? 5 * 60 * 1000 : period === 'today' ? 0 : 1 * 60 * 1000,
    refetchOnWindowFocus: period === 'today',
  })

  const {
    data: kpis,
    isLoading: isLoadingKPIs,
    error: kpisError,
  } = useQuery({
    queryKey: ['analytics-kpis', apiParams, refreshKey],
    queryFn: () => getKPIs(apiParams),
    staleTime,
    refetchOnWindowFocus: period === 'today',
  })

  // Charger les prédictions pour toutes les périodes
  const {
    data: predictions,
    isLoading: isLoadingPredictions,
    error: predictionsError,
  } = useQuery({
    queryKey: ['analytics-predictions', refreshKey],
    queryFn: getPredictions,
    staleTime: period === 'today' ? 0 : period === 'all' ? 5 * 60 * 1000 : 1 * 60 * 1000,
    refetchOnWindowFocus: period === 'today',
  })

  // Handler pour changer la période
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod)
    // Pour les périodes non-custom, les données se rechargeront automatiquement
    // car apiParams change et est dans les query keys
  }

  // Handler pour changer les dates custom avec auto-refresh
  const handleStartDateChange = (date: Date | null) => {
    setStartDate(date)
    if (period === 'custom' && date && endDate) {
      setRefreshKey((prev) => prev + 1)
    }
  }

  const handleEndDateChange = (date: Date | null) => {
    setEndDate(date)
    if (period === 'custom' && startDate && date) {
      setRefreshKey((prev) => prev + 1)
    }
  }

  // Fonction helper pour vérifier les erreurs silencieuses
  const isSilentError = (error: unknown): boolean => {
    if (!error) return false
    const errorMessage = (error as Error)?.message || ''
    return (
      errorMessage.includes('Unauthorized during logout') ||
      errorMessage.includes('Ignoring') ||
      (error as Error & { silent?: boolean })?.silent === true
    )
  }

  // Afficher les erreurs (sauf les erreurs silencieuses de déconnexion)
  useEffect(() => {
    if (overviewError && !isSilentError(overviewError) && !(overviewError as Error).message.includes('Non authentifié')) {
      toast.error(t('errors.loading'))
    }
    if (trendsError && !isSilentError(trendsError) && !(trendsError as Error).message.includes('Non authentifié')) {
      toast.error(t('errors.loading'))
    }
    if (categoryError && !isSilentError(categoryError) && !(categoryError as Error).message.includes('Non authentifié')) {
      toast.error(t('errors.loading'))
    }
    if (comparisonsError && !isSilentError(comparisonsError) && !(comparisonsError as Error).message.includes('Non authentifié')) {
      toast.error(t('errors.loading'))
    }
    if (kpisError && !isSilentError(kpisError) && !(kpisError as Error).message.includes('Non authentifié')) {
      toast.error(t('errors.loading'))
    }
    if (predictionsError && !isSilentError(predictionsError) && !(predictionsError as Error).message.includes('Non authentifié')) {
      toast.error(t('errors.loading'))
    }
  }, [
    overviewError,
    trendsError,
    categoryError,
    comparisonsError,
    kpisError,
    predictionsError,
    t,
  ])

  // Calculer isLoading en excluant les queries désactivées pour "Depuis toujours"
  const isLoading =
    isLoadingOverview ||
    isLoadingTrends ||
    isLoadingCategory ||
    (period !== 'all' && isLoadingComparisons) ||
    isLoadingKPIs ||
    isLoadingPredictions

  // Fonction pour réinitialiser toutes les données Analytics
  const resetAnalytics = useCallback(() => {
    // Supprimer toutes les queries Analytics du cache
    queryClient.removeQueries({ queryKey: ['analytics-overview'] })
    queryClient.removeQueries({ queryKey: ['analytics-trends'] })
    queryClient.removeQueries({ queryKey: ['analytics-category'] })
    queryClient.removeQueries({ queryKey: ['analytics-comparisons'] })
    queryClient.removeQueries({ queryKey: ['analytics-kpis'] })
    queryClient.removeQueries({ queryKey: ['analytics-predictions'] })
    
    // Réinitialiser l'état de l'utilisateur
    setDataUserId(null)
    setIsInitialLoad(true)
  }, [queryClient])

  // Réinitialiser lors du changement d'utilisateur
  useEffect(() => {
    if (user) {
      const currentUserId = String(user.id || user.email || '')
      
      // Si l'utilisateur a changé, réinitialiser
      if (dataUserId && dataUserId !== currentUserId) {
        const timer = setTimeout(() => {
          resetAnalytics()
          // Mettre à jour l'état après la réinitialisation
          setTimeout(() => {
            setDataUserId(currentUserId)
            setIsInitialLoad(false)
          }, 50)
        }, 50)
        return () => clearTimeout(timer)
      }
      
      // Mettre à jour l'état après un court délai pour permettre le chargement
      const timer = setTimeout(() => {
        setDataUserId(currentUserId)
        setIsInitialLoad(false)
      }, 100)

      return () => clearTimeout(timer)
    } else {
      // Utilisateur déconnecté, réinitialiser
      const timer = setTimeout(() => {
        resetAnalytics()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [user, dataUserId, resetAnalytics])

  // Écouter les événements de reset des Analytics
  useEffect(() => {
    const handleAnalyticsReset = () => {
      resetAnalytics()
    }

    window.addEventListener('analytics:reset', handleAnalyticsReset)

    return () => {
      window.removeEventListener('analytics:reset', handleAnalyticsReset)
    }
  }, [resetAnalytics])

  // Écouter les événements de rafraîchissement des Analytics
  useEffect(() => {
    const handleAnalyticsRefresh = async () => {
      if (!user) {
        console.log('⚠️ Rafraîchissement Analytics ignoré : utilisateur non connecté')
        return
      }
      
      console.log('🔄 Rafraîchissement des Analytics demandé - Invalidation et refetch des queries')
      
      // Invalider et forcer le refetch immédiat de toutes les queries Analytics
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['analytics-overview'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['analytics-trends'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['analytics-category'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['analytics-comparisons'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['analytics-kpis'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['analytics-predictions'], refetchType: 'active' }),
      ])
      
      // Forcer le refetch immédiat de toutes les queries actives
      await queryClient.refetchQueries({ queryKey: ['analytics-overview'] })
      await queryClient.refetchQueries({ queryKey: ['analytics-trends'] })
      await queryClient.refetchQueries({ queryKey: ['analytics-category'] })
      if (period !== 'all') {
        await queryClient.refetchQueries({ queryKey: ['analytics-comparisons'] })
      }
      await queryClient.refetchQueries({ queryKey: ['analytics-kpis'] })
      await queryClient.refetchQueries({ queryKey: ['analytics-predictions'] })
      
      console.log('✅ Queries Analytics invalidées et refetchées - Les données sont à jour')
    }

    window.addEventListener('analytics:refresh', handleAnalyticsRefresh)
    console.log('👂 Écouteur analytics:refresh ajouté')

    return () => {
      window.removeEventListener('analytics:refresh', handleAnalyticsRefresh)
      console.log('👂 Écouteur analytics:refresh retiré')
    }
  }, [queryClient, user, period])

  // Vérifier que les données correspondent à l'utilisateur actuel
  const shouldShowData = user && (
    !dataUserId || 
    dataUserId === String(user.id || user.email || '')
  )

  // Vérifier s'il y a des erreurs d'authentification (401)
  const hasAuthError = 
    (overviewError && (overviewError as Error).message.includes('Non authentifié')) ||
    (trendsError && (trendsError as Error).message.includes('Non authentifié')) ||
    (categoryError && (categoryError as Error).message.includes('Non authentifié')) ||
    (comparisonsError && (comparisonsError as Error).message.includes('Non authentifié')) ||
    (kpisError && (kpisError as Error).message.includes('Non authentifié')) ||
    (predictionsError && (predictionsError as Error).message.includes('Non authentifié'))

  // Obtenir le premier message d'erreur (non silencieuse, non auth)
  const getFirstError = (): Error | null => {
    const errors = [overviewError, trendsError, categoryError, comparisonsError, kpisError, predictionsError]
    for (const error of errors) {
      if (error && !isSilentError(error) && !(error as Error).message.includes('Non authentifié')) {
        return error as Error
      }
    }
    return null
  }

  // Afficher les erreurs d'authentification
  if (hasAuthError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">{t('errors.redirecting')}</p>
      </div>
    )
  }

  // Afficher les autres erreurs
  const firstError = getFirstError()
  if (firstError) {
    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errors.loading')}</AlertTitle>
          <AlertDescription>
            {firstError.message || t('errors.loadingDescription')}
            <br />
            <span className="text-xs mt-2 block">
              {t('errors.loadingHelp')}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Afficher un loader si pas d'utilisateur, chargement initial, données ne correspondent pas, ou chargement en cours
  if (!user || isInitialLoad || !shouldShowData || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Section 1: Filtres avec skeleton */}
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 w-24 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </div>

        {/* Section 2: Aperçu avec skeleton */}
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="@container/card h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>

        {/* Autres sections avec skeleton */}
        <div className="space-y-6">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Section 1: Filtres */}
      <AnalyticsFilters
        period={period}
        onPeriodChange={handlePeriodChange}
        startDate={startDate}
        onStartDateChange={handleStartDateChange}
        endDate={endDate}
        onEndDateChange={handleEndDateChange}
        loading={isLoading}
      />

      {/* Section 2: Aperçu des performances globales */}
      <OverviewCards 
        data={overview ?? null} 
        comparisons={comparisons ?? null}
        isLoading={isLoadingOverview} 
      />

      {/* Section 3: Graphiques de tendances */}
      <TrendsCharts data={trends ?? null} isLoading={isLoadingTrends} />

      {/* Section 4: Analyse par catégorie */}
      <CategoryCharts data={categoryAnalysis ?? null} isLoading={isLoadingCategory} />

      {/* Section 5: Comparaisons temporelles */}
      {/* <ComparisonCards data={comparisons ?? null} isLoading={isLoadingComparisons} /> */}

      {/* Section 6: Ratios financiers & KPI */}
      <KPICards data={kpis ?? null} isLoading={isLoadingKPIs} />

  

      {/* Section 8: Prédictions de réapprovisionnement */}
      <PredictionsTable data={predictions ?? null} isLoading={isLoadingPredictions} />
    </div>
  )
}
