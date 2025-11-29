'use client'

import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Package, TrendingUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import type { Article } from '@/lib/services/articles'
import { useCurrency } from '@/lib/utils/currency';

/**
 * Interface Product pour compatibilité avec l'ancien code
 * Utilise les données de l'API Laravel (Article)
 */
export interface Product {
  id: string;
  name: string;
  type: 'simple' | 'variable';
  quantity_sold: number;
  quantity_remaining: number;
  price: number;
  low_stock_threshold?: number;
}

/**
 * Convertit un Article de l'API en Product pour le composant
 */
export function articleToProduct(article: Article): Product {
  return {
    id: String(article.id),
    name: article.name,
    type: article.type,
    quantity_sold: article.sold_quantity,
    quantity_remaining: article.remaining_quantity,
    price: article.sale_price,
    low_stock_threshold: article.low_stock ? 10 : undefined, // Seuil par défaut si stock faible
  }
}

interface ProductCardProps {
  product: Product | Article; // Accepter soit Product soit Article directement
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  
  // Normaliser les données : convertir Article en Product si nécessaire
  const isArticle = 'sale_price' in product && 'sold_quantity' in product
  const normalizedProduct: Product = isArticle
    ? articleToProduct(product as Article)
    : (product as Product)
  
  const article = isArticle ? (product as Article) : null
  
  // Utiliser directement sales_percentage de l'API (déjà calculé côté backend)
  // Ne pas recalculer, utiliser la valeur telle quelle, comme sur la page de détail
  const totalQuantity = normalizedProduct.quantity_sold + normalizedProduct.quantity_remaining;
  // Utiliser directement la valeur de l'API sans modification
  // Accéder à sales_percentage depuis l'article original (avant conversion en Product)
  const stockPercentage = isArticle 
    ? ((product as Article).sales_percentage ?? 0)
    : 0;

  const { t } = useTranslation()
  const { currency } = useCurrency()
  
  // Déterminer le statut du stock
  const getStockStatus = () => {
    if ((normalizedProduct.quantity_remaining || 0) === 0) {
      return { 
        label: t('products.stockStatus.outOfStock'), 
        variant: 'destructive' as const,
        color: 'red'
      }
    }
    if (article!.low_stock) {
      return { 
        label: t('products.stockStatus.lowStock'), 
        variant: 'secondary' as const,
        color: 'orange'
      }
    }
    return { 
      label: t('products.stockStatus.inStock'), 
      variant: 'default' as const,
      color: 'green'
    }
  }
  

  const stockStatus = getStockStatus();

  // Formatage des nombres
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("fr-FR").format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleClick = () => {
    router.push(`/products/${normalizedProduct.id}`);
  };

  return (
    <Card 
      className="group hover:shadow-lg transition-all duration-200 cursor-pointer border hover:border-primary/50"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {normalizedProduct.name}
              </CardTitle>
              <CardDescription className="mt-1 text-xs">
                {t('products.unitPrice')}: {formatCurrency(normalizedProduct.price)} {currency}
              </CardDescription>
            </div>
          </div>
          {/* Badges sur une seule ligne horizontale */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline"
              className={cn(
                "text-xs shrink-0 font-medium",
                normalizedProduct.type === 'simple' 
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
              )}
            >
              {normalizedProduct.type === 'simple' ? t('products.simple') : t('products.variable')}
            </Badge>
            <Badge 
              variant="outline"
              className={cn(
                "text-xs shrink-0 font-medium",
                stockStatus.variant === 'destructive' && "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
                stockStatus.variant === 'secondary' && "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
                stockStatus.variant === 'default' && "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
              )}
            >
              {stockStatus.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Statistiques de quantité */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Vendues</p>
              <p className="text-sm font-semibold">{formatNumber(normalizedProduct.quantity_sold)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{t('products.remaining')}</p>
              <p className="text-sm font-semibold">{formatNumber(normalizedProduct.quantity_remaining)}</p>
            </div>
          </div>
        </div>

        {/* Barre de progression du stock */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('products.stockLevel')}</span>
            <span className="font-medium">{stockPercentage ? stockPercentage.toFixed(1) : '0.0'}%</span>
          </div>
          <div className="relative w-full">
            <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  stockPercentage === 0 && "bg-red-500",
                  stockPercentage > 0 && stockPercentage < 20 && "bg-orange-500",
                  stockPercentage >= 20 && stockPercentage < 50 && "bg-yellow-500",
                  stockPercentage >= 50 && "bg-green-500"
                )}
                style={{ width: `${stockPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          {t('dashboard.total')}: {formatNumber(totalQuantity)} {t('common.pieces')}
        </p>
      </CardFooter>
    </Card>
  );
}

