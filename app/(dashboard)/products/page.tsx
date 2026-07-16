'use client'

import { useUserStats, useArticles } from '@/lib/hooks/useArticles'
import { ProductsHeader } from '@/components/products/products-header'
import { ProductsListHeader } from '@/components/products/products-list-header'
import { ProductsGrid } from '@/components/products/products-grid'
import { ProductsHeaderSkeleton, ProductsGridSkeleton } from '@/components/products/products-skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

/**
 * Page principale des produits
 * 
 * Cette page :
 * 1. Récupère les statistiques utilisateur via GET /api/user
 * 2. Récupère la liste des articles via GET /api/articles
 * 3. Affiche les données dans des composants réutilisables
 * 4. Gère le chargement avec des skeletons intelligents
 * 5. Gère les erreurs (401 → redirect, 500 → message)
 * 
 * Le skeleton s'affiche UNIQUEMENT si aucune donnée n'existe (premier chargement)
 * Les données en cache restent visibles pendant les revalidations (pas de clignotement)
 * Les revalidations se font en arrière-plan après mutations
 */
export default function ProductsPage() {
  // Récupérer les statistiques utilisateur avec SWR
  const { stats, error: statsError, isLoading: isLoadingStats } = useUserStats()

  // Récupérer la liste des articles avec SWR
  const { articles, error: articlesError, isLoading: isLoadingArticles } = useArticles()

  // États de chargement
  const isLoading = isLoadingStats || isLoadingArticles
  const error = statsError || articlesError

  // Normaliser les articles pour garantir qu'on a toujours un tableau
  const articlesArray: typeof articles = Array.isArray(articles) ? articles : []

  // Préparer les statistiques pour l'en-tête
  const headerStats = {
    total_models: stats?.total_articles,
    total_remaining_quantity: stats?.total_remaining_quantity,
    total_stock_value: stats?.total_stock_value,
    low_stock_models: stats?.total_low_stock,
  }

  // Afficher le skeleton pendant le chargement
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <ProductsHeaderSkeleton />
        <div className="px-4 lg:px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-7 w-48 bg-muted animate-pulse rounded" />
            <div className="h-10 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <ProductsGridSkeleton />
      </div>
    )
  }

  // Afficher les erreurs
  if (error) {
    // Erreur 401 : redirection automatique gérée par le service
    // Pour les autres erreurs, afficher un message
    const isAuthError = error.message.includes('Non authentifié')
    
    if (isAuthError) {
      // La redirection est déjà gérée, juste afficher un message temporaire
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Redirection vers la page de connexion...</p>
        </div>
      )
    }

    // Autres erreurs (500, réseau, etc.)
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

  // Afficher le contenu principal
  return (
    <div className="flex flex-col gap-6 py-6">
      {/* En-tête avec statistiques */}
      <ProductsHeader stats={headerStats} />

      {/* En-tête de la liste avec bouton Ajouter */}
      <ProductsListHeader
        productsCount={articlesArray.length}
      />

      {/* Grille de produits - passe les articles normalisés */}
      <ProductsGrid products={articlesArray} />
    </div>
  )
}
