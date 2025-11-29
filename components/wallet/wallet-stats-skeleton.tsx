import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader pour les statistiques wallet
 */
export function WalletStatsSkeleton() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="@container/card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </CardHeader>
          <CardHeader className="pt-1">
            <Skeleton className="h-8 w-32 @[250px]/card:h-10" />
          </CardHeader>
          <CardHeader className="pt-1">
            <Skeleton className="h-3 w-40" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

