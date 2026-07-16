'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { getWalletStats, type WalletStats as WalletStatsType } from '@/lib/services/transactions';
import { WalletStatsSkeleton } from './wallet-stats-skeleton';
import { toast } from 'sonner';
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import { useCurrency } from '@/lib/utils/currency';

/**
 * Extension du type Window pour inclure reloadWalletStats
 */
declare global {
  interface Window {
    reloadWalletStats?: () => void;
  }
}

/**
 * Composant affichant les 4 cards de statistiques du wallet
 */
interface WalletStatsProps {
  refreshTrigger?: number;
}

export function WalletStats({ refreshTrigger }: WalletStatsProps = {}) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [stats, setStats] = useState<WalletStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWalletStats();
      setStats({
        calculated_wallet: data.calculated_wallet || 0,
        total_sale: data.total_sale || 0,
        total_expense: data.total_expense || 0,
        wallet: data.wallet || 0,
      });
    } catch (error) {
      const err = error as Error;
      // Ne pas afficher de toast si c'est une erreur d'authentification (redirection automatique)
      if (!err.message.includes('Non authentifié')) {
        console.error('Erreur lors du chargement des statistiques:', error);
        toast.error(t('errors.loading'));
      }
      // Remonter l'erreur pour que la page parent puisse la gérer
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Recharger quand refreshTrigger change
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchStats();
    }
  }, [refreshTrigger, fetchStats]);

  // Exposer la fonction de rechargement pour les composants enfants
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.reloadWalletStats = fetchStats;
    }
  }, [fetchStats]);

  if (loading) {
    return <WalletStatsSkeleton />;
  }

  if (!stats) {
    return null;
  }

  const displayStats = {
    current_balance: stats.calculated_wallet || 0,
    total_sales: stats.total_sale || 0,
    total_expenses: stats.total_expense || 0,
    personal_revenue: stats.wallet || 0,
  };
  // Formatage des valeurs
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-2 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Card 1 : Solde actuel */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('wallet.currentBalance')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(displayStats.current_balance)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency}
            </span>
          </CardTitle>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardDescription className="text-xs">
            {t('wallet.currentBalanceDescription')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Card 2 : Montant total des ventes */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('wallet.totalSales')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(displayStats.total_sales)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency}
            </span>
          </CardTitle>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardDescription className="text-xs">
            {t('wallet.totalSalesDescription')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Card 3 : Montant total des dépenses */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('wallet.totalExpenses')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
            <TrendingDown className="h-4 w-4 text-red-500" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(displayStats.total_expenses)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency}
            </span>
          </CardTitle>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardDescription className="text-xs">
            {t('wallet.totalExpensesDescription')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Card 4 : Revenu personnel */}
      <Card className="@container/card group hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('wallet.personalRevenue')}
          </CardTitle>
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <DollarSign className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardTitle className="text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            {formatCurrency(displayStats.personal_revenue)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {currency}
            </span>
          </CardTitle>
        </CardHeader>
        <CardHeader className="pt-1">
          <CardDescription className="text-xs">
            {t('wallet.personalRevenueDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

