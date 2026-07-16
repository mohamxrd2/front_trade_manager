'use client'

import { useState } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from '@/lib/utils/currency';

// Configurer dayjs en français
dayjs.locale('fr')

export type TransactionType = 'sale' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  name: string;
  quantity?: number | null; // Pour les ventes
  unit_price?: number | null; // Pour les ventes (alias pour compatibilité)
  sale_price?: number | null; // Pour les ventes (prix unitaire)
  amount?: number; // Pour les dépenses
  date: string; // Format: YYYY-MM-DD
}

interface TransactionCardProps {
  transaction: Transaction;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Composant affichant une carte de transaction (vente ou dépense)
 */
export function TransactionCard({ transaction, onEdit, onDelete }: TransactionCardProps) {
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete?.(transaction.id);
    setShowDeleteDialog(false);
  };
  // Formater la date avec dayjs (YYYY-MM-DD ou ISO -> "12 mai 2025")
  const formatDate = (dateString: string) => {
    return dayjs(dateString).format('DD MMMM YYYY');
  };

  // Calculer le montant total
  const getTotalAmount = () => {
    if (transaction.type === 'sale') {
      return (transaction.quantity || 0) * (transaction.unit_price || 0);
    }
    return transaction.amount || 0;
  };

  // Formater le montant
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Obtenir le titre de la transaction


  return (
    <div className="border rounded-xl p-4 sm:p-5 hover:shadow-lg transition-all bg-card hover:border-primary/30 border-border/50">
      {/* Layout Desktop : Horizontal */}
      <div className="hidden md:flex items-center justify-between gap-6">
        {/* Colonne 1 : Type et Titre */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 px-3 py-1.5 font-medium',
              transaction.type === 'sale'
                ? 'text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950'
                : 'text-red-700 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950'
            )}
          >
            {transaction.type === 'sale' ? 'Vente' : 'Dépense'}
          </Badge>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate text-foreground">{transaction.name}</h3>
            {transaction.type === 'sale' && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {transaction.quantity} × {formatCurrency(transaction.unit_price || 0)} {currency}
              </p>
            )}
          </div>
        </div>

        {/* Colonne 2 : Montant */}
        <div className="text-right shrink-0 min-w-[150px]">
          <span className={cn(
            "text-xl font-bold",
            transaction.type === 'sale' 
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          )}>
            {transaction.type === 'sale' ? '+' : '-'} {formatCurrency(getTotalAmount())} {currency}
          </span>
        </div>

        {/* Colonne 3 : Date */}
        <div className="text-sm text-muted-foreground shrink-0 min-w-[150px] text-right font-medium">
          {formatDate(transaction.date)}
        </div>

        {/* Colonne 4 : Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit?.(transaction.id)}
            className="h-9 w-9 hover:bg-blue-50 dark:hover:bg-blue-950/50"
          >
            <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteClick}
            className="h-9 w-9 hover:bg-red-50 dark:hover:bg-red-950/50"
          >
            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
          </Button>
        </div>
      </div>

      {/* Layout Mobile : Vertical */}
      <div className="flex flex-col gap-4 md:hidden">
        {/* En-tête : Type, Titre et Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 px-2.5 py-1 font-medium text-xs',
                transaction.type === 'sale'
                  ? 'text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950'
                  : 'text-red-700 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950'
              )}
            >
              {transaction.type === 'sale' ? t('transactions.sale') : t('transactions.expense')}
            </Badge>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate text-foreground">{transaction.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit?.(transaction.id)}
              className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            >
              <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              className="h-8 w-8 hover:bg-red-50 dark:hover:bg-red-950/50"
            >
              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
            </Button>
          </div>
        </div>

        {/* Détails : Montant, Date et Détails de vente */}
        <div className="flex flex-col gap-2 pl-0">
          {transaction.type === 'sale' && (
            <p className="text-xs text-muted-foreground">
              {transaction.quantity} × {formatCurrency(transaction.unit_price || 0)} {currency}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">
              {formatDate(transaction.date)}
            </span>
            <span className={cn(
              "text-lg font-bold",
              transaction.type === 'sale' 
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            )}>
              {transaction.type === 'sale' ? '+' : '-'} {formatCurrency(getTotalAmount())} {currency}
            </span>
          </div>
        </div>
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('transactions.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('transactions.deleteConfirmDescription')}
              <br />
              <span className="font-medium mt-2 block">
              {transaction.name} - {formatCurrency(getTotalAmount())} {currency}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

