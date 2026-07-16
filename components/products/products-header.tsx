'use client'

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingBag, Package, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import { useCurrency } from '@/lib/utils/currency';

interface ProductsStats {
  total_models?: number;
  total_remaining_quantity?: number;
  total_stock_value?: number;
  low_stock_models?: number;
}

export function ProductsHeader({
  stats,
}: {
  stats: ProductsStats;
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
    <div className="grid grid-cols-1 gap-2 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Carte Nombre total de modèles */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('products.totalModels')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(stats.total_models)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {t('common.models')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start pt-1">
          <CardDescription className="text-xs">
            {t('products.totalModelsDescription')}
          </CardDescription>
        </CardFooter>
      </Card>

      {/* Carte Nombre de pièces restantes */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('products.remainingPieces')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Package className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatNumber(stats.total_remaining_quantity)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {t('common.pieces')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start pt-1">
          <CardDescription className="text-xs">
            {t('products.remainingPiecesDescription')}
          </CardDescription>
        </CardFooter>
      </Card>

      {/* Carte Valeur totale du stock */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('products.stockValue')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
            <DollarSign className="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(stats.total_stock_value)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start pt-1">
          <CardDescription className="text-xs">
            {t('products.stockValueDescription')}
          </CardDescription>
        </CardFooter>
      </Card>

      {/* Carte Nombre de modèles en stock faible */}
      <Card
        className={cn(
          "@container/card group hover:shadow-md transition-shadow",
          stats.low_stock_models &&
            stats.low_stock_models > 0 &&
            "border-orange-200 dark:border-orange-800"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('products.lowStock')}
          </CardTitle>
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
              stats.low_stock_models && stats.low_stock_models > 0
                ? "bg-orange-500/10 group-hover:bg-orange-500/20"
                : "bg-gray-500/10 group-hover:bg-gray-500/20"
            )}
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                stats.low_stock_models && stats.low_stock_models > 0
                  ? "text-orange-500"
                  : "text-gray-500"
              )}
            />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle
            className={cn(
              "text-2xl font-bold tabular-nums @[250px]/card:text-3xl",
              stats.low_stock_models &&
                stats.low_stock_models > 0 &&
                "text-orange-600 dark:text-orange-400"
            )}
          >
            {formatNumber(stats.low_stock_models)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {t('common.models')}
            </span>
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start pt-1">
          <CardDescription className="text-xs">
            {stats.low_stock_models && stats.low_stock_models > 0
              ? t('products.lowStockDescription')
              : t('products.noLowStock')}
          </CardDescription>
        </CardFooter>
      </Card>
    </div>
  );
}

