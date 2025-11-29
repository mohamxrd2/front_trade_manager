'use client'

import { useState, useMemo, useEffect } from 'react'
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TransactionCard, type Transaction } from './transaction-card';
import { EditTransactionDialog } from './edit-transaction-dialog';
import { TransactionListSkeleton } from './transaction-list-skeleton';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getTransactions, updateTransaction, deleteTransaction, type UpdateSalePayload, type UpdateExpensePayload } from '@/lib/services/transactions';
import { useAnalyticsRefresh } from '@/lib/hooks/use-analytics-refresh'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { isSilentError } from '@/lib/utils/error-handler'

interface TransactionListProps {
  onTransactionAdded?: (transaction: Transaction) => void;
  refreshKey?: number | undefined;
}

/**
 * Composant affichant la liste des transactions avec recherche et filtres
 */
export function TransactionList(props: TransactionListProps = {}) {
  const { t } = useTranslation()
  const { refreshKey } = props;
  const { refreshAnalytics } = useAnalyticsRefresh();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'expense'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const data = await getTransactions();
      setTransactions(data);
    } catch (error) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        return
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur lors du chargement des transactions:', error)
      }
      toast.error(t('errors.loading'))
    } finally {
      setLoading(false);
    }
  };

  // Recharger les statistiques wallet après modification/suppression
  const reloadWalletStats = () => {
    if (typeof window !== 'undefined') {
      const reloadFn = (window as { reloadWalletStats?: () => void }).reloadWalletStats
      if (reloadFn) {
        reloadFn()
      }
    }
  };

  // Charger les transactions au montage et quand refreshKey change
  useEffect(() => {
    fetchTransactions();
    // Recharger aussi les statistiques wallet si refreshKey est défini et > 0
    if (refreshKey && refreshKey > 0) {
      reloadWalletStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey ?? 0]);

  // Filtrer les transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      // Filtre par type
      if (filterType !== 'all' && transaction.type !== filterType) {
        return false;
      }

      // Filtre par recherche
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = transaction.name.toLowerCase().includes(query);
        return nameMatch;
      }

      return true;
    });
  }, [searchQuery, filterType, transactions]);

  // Réinitialiser à la page 1 quand les transactions filtrées changent
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredTransactions.length, searchQuery, filterType]);

  // Calculs de pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const handleEdit = (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (transaction) {
      setEditingTransaction(transaction);
      setIsEditDialogOpen(true);
    }
  };

  const handleSave = async (id: string, data: Partial<Transaction>) => {
    try {
      // Le payload est déjà préparé dans EditTransactionDialog
      // On reçoit directement les données formatées
      const transaction = transactions.find((t) => t.id === id);
      if (!transaction) {
        toast.error('Transaction non trouvée');
        return;
      }

      // Préparer le payload selon le type de transaction
      let payload: UpdateSalePayload | UpdateExpensePayload;

      if (transaction.type === 'sale') {
        // Pour une vente, le payload contient name, et optionnellement quantity et/ou sale_price
        payload = {
          name: data.name as string,
          ...(data.quantity !== undefined && { quantity: Number(data.quantity) }),
          ...(data.sale_price !== undefined && { sale_price: Number(data.sale_price) }),
        };
      } else {
        // Pour une dépense, le payload contient name, et optionnellement amount
        payload = {
          name: data.name as string,
          ...(data.amount !== undefined && { amount: Number(data.amount) }),
        };
      }

      console.log('📋 Payload final envoyé à l\'API:', payload);
      
      // Appeler l'API
      const updatedTransaction = await updateTransaction(id, payload);
      
      console.log('✅ Transaction mise à jour:', updatedTransaction);
      
      // Mettre à jour le state local et maintenir le tri par date décroissante
      setTransactions((prev) => {
        const updated = prev.map((t) =>
          t.id === id
            ? updatedTransaction
            : t
        );
        // Retrier par date décroissante après mise à jour
        return updated.sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA; // Ordre décroissant
        });
      });

      // Recharger les statistiques
      reloadWalletStats();
      
      // Rafraîchir les Analytics (EditTransactionDialog appelle déjà refreshAnalytics, mais on le fait aussi ici pour être sûr)
      refreshAnalytics();

      toast.success('Transaction modifiée avec succès !');
      setIsEditDialogOpen(false);
      setEditingTransaction(null);
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        return
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur lors de la modification:', error)
      }
      
      const errorObj = error as { validationErrors?: unknown; message?: string }
      if (errorObj.validationErrors) {
        // Erreurs de validation gérées dans EditTransactionDialog
        throw error
      } else {
        toast.error(errorObj.message || t('errors.loading'))
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      
      // Retirer du state local (le tri est déjà maintenu car on ne fait que filtrer)
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      
      // Recharger les statistiques
      reloadWalletStats();
      
      // Rafraîchir les Analytics
      refreshAnalytics();

      toast.success('Transaction supprimée avec succès !');
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        return
      }
      
      const errorMessage = error instanceof Error ? error.message : t('errors.loading')
      if (errorMessage === 'Transaction non trouvée') {
        toast.error('Transaction non trouvée')
      } else {
        toast.error(errorMessage)
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Zone de recherche + filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('transactions.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
            className="shrink-0"
          >
            {t('transactions.all')}
          </Button>
          <Button
            variant={filterType === 'sale' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('sale')}
            className="shrink-0"
          >
            {t('transactions.sales')}
          </Button>
          <Button
            variant={filterType === 'expense' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('expense')}
            className="shrink-0"
          >
            {t('transactions.expenses')}
          </Button>
        </div>
      </div>

      {/* Liste des transactions */}
      {loading ? (
        <TransactionListSkeleton />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('transactions.noTransactions')}</p>
              </div>
            ) : (
              paginatedTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {filteredTransactions.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {t('common.showing')} {startIndex + 1} {t('common.to')} {Math.min(endIndex, filteredTransactions.length)} {t('common.of')} {filteredTransactions.length} {t('transactions.title').toLowerCase()}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common.previous')}
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Afficher seulement la première page, la dernière, la page actuelle et les pages adjacentes
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px]"
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog de modification */}
      <EditTransactionDialog
        transaction={editingTransaction}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSave}
      />
    </div>
  );
}

