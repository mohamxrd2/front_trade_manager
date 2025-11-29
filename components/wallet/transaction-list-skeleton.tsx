import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Skeleton loader pour la liste des transactions
 */
export function TransactionListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="border rounded-xl p-4 sm:p-5">
          <div className="hidden md:flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Skeleton className="h-6 w-16" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32 mt-2" />
              </div>
            </div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          <div className="flex flex-col gap-4 md:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

