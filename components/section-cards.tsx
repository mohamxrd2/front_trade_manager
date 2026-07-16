'use client'

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet, Package, ShoppingBag, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import { useCurrency } from '@/lib/utils/currency';

export function SectionCards({
  user,
}: {
  user: {
    total_articles?: number;
    total_low_stock?: number;
    total_remaining_quantity?: number;
    calculated_wallet?: number;
  };
}) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  
  // Formatage des valeurs avec des valeurs par défaut
  const formatCurrency = (value?: number) => {
    if (!value && value !== 0) return "0";
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value?: number) => {
    if (!value && value !== 0) return "0";
    return new Intl.NumberFormat("fr-FR").format(value);
  };

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Carte Portefeuille / Revenu total */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('dashboard.netRevenue')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(user.calculated_wallet)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start  pt-1">
          <CardDescription className="text-xs">
            {t('dashboard.netRevenueDescription')}
          </CardDescription>
        </CardFooter>
      </Card>

      {/* Carte Quantité restante */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('dashboard.availableStock')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Package className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardHeader >
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(user.total_remaining_quantity)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {t('common.pieces')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start  pt-1">
          <CardDescription className="text-xs">
            {t('dashboard.availableStockDescription')}
          </CardDescription>
        </CardFooter>
      </Card>

      {/* Carte Nombre d'articles */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('dashboard.catalog')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
            <ShoppingBag className="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardHeader >
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(user.total_articles)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {t('common.models')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start  pt-1">
          <CardDescription className="text-xs">
            {t('dashboard.catalogDescription')}
          </CardDescription>
        </CardFooter>
      </Card>

      {/* Carte Stock faible */}
      <Card
        className={cn(
          "@container/card group hover:shadow-md transition-shadow",
          user.total_low_stock &&
            user.total_low_stock > 0 &&
            "border-orange-200 dark:border-orange-800"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('dashboard.stockAlert')}
          </CardTitle>
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
              user.total_low_stock && user.total_low_stock > 0
                ? "bg-orange-500/10 group-hover:bg-orange-500/20"
                : "bg-gray-500/10 group-hover:bg-gray-500/20"
            )}
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                user.total_low_stock && user.total_low_stock > 0
                  ? "text-orange-500"
                  : "text-gray-500"
              )}
            />
          </div>
        </CardHeader>
        <CardHeader >
          <CardTitle
            className={cn(
              "text-2xl font-bold tabular-nums @[250px]/card:text-3xl",
              user.total_low_stock &&
                user.total_low_stock > 0 &&
                "text-orange-600 dark:text-orange-400"
            )}
          >
            {formatNumber(user.total_low_stock)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {t('common.models')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start  pt-1">
          <CardDescription className="text-xs">
            {user.total_low_stock && user.total_low_stock > 0
              ? t('dashboard.stockAlertDescription')
              : t('dashboard.noStockAlert')}
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  );
}
