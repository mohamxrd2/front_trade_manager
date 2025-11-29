import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton loader pour la page dashboard
 * Affiche des placeholders pour les cartes de statistiques et le graphique
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Skeleton pour les cartes de statistiques */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="@container/card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardHeader className="pt-1">
              <Skeleton className="h-8 w-32" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 pt-1">
              <Skeleton className="h-3 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Skeleton pour le graphique */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

