import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton loader pour les cartes de statistiques dans l'en-tête
 */
export function ProductsHeaderSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="@container/card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </CardHeader>
          <CardHeader className="pt-1">
            <Skeleton className="h-8 w-32" />
          </CardHeader>
          <CardFooter className="flex-col items-start pt-1">
            <Skeleton className="h-3 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

/**
 * Skeleton loader pour une carte de produit
 */
export function ProductCardSkeleton() {
  return (
    <Card className="group">
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="pt-2 border-t">
        <Skeleton className="h-3 w-32" />
      </CardFooter>
    </Card>
  )
}

/**
 * Skeleton loader pour la grille de produits
 */
export function ProductsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4 lg:px-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

