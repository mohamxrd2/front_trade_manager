'use client'

import { SectionCards } from "@/components/section-cards"
import { useUserStats } from "@/lib/hooks/useArticles"
import { DashboardSkeleton } from "@/components/dashboard-skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"

/**
 * Page Dashboard
 * 
 * Affiche les statistiques utilisateur et les graphiques
 * Utilise SWR pour récupérer les données
 */
export default function DashboardPage() {
  // Récupérer les statistiques utilisateur avec SWR
  const { stats, error, isLoading } = useUserStats()

  // Afficher le skeleton pendant le chargement
  if (isLoading) {
    return <DashboardSkeleton />
  }

  // Afficher les erreurs
  if (error) {
    const isAuthError = error.message.includes('Non authentifié')
    
    if (isAuthError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Redirection vers la page de connexion...</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription>
            {error.message || 'Une erreur est survenue lors du chargement des données.'}
            <br />
            <span className="text-xs mt-2 block">
              Veuillez rafraîchir la page ou contacter le support si le problème persiste.
            </span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Préparer les données utilisateur
  const userData = {
    total_articles: stats?.total_articles,
    total_low_stock: stats?.total_low_stock,
    total_remaining_quantity: stats?.total_remaining_quantity,
    calculated_wallet: stats?.calculated_wallet,
  }

  return (
    <>
      <SectionCards user={userData} />
      <div className="px-4 lg:px-6 py-6">
        <ChartAreaInteractive />
      </div>
      <DashboardContent />
    </>
  )
}
 