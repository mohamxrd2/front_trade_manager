'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";
import type { Transaction } from "./transaction-card";

interface WalletActionsProps {
  onTransactionAdded?: (transaction: Transaction) => void;
}

/**
 * Composant affichant les boutons d'action pour ajouter une vente ou une dépense
 */
export function WalletActions({ onTransactionAdded }: WalletActionsProps) {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddTransaction = () => {
    setDialogOpen(true);
  };

  const handleSuccess = (transaction: Transaction) => {
    if (onTransactionAdded) {
      onTransactionAdded(transaction);
    }
    setDialogOpen(false);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end w-full sm:w-auto">
        <Button
          onClick={handleAddTransaction}
          size="sm"
          variant="default"
          className={cn(
            "gap-2 bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto",
            "dark:bg-green-700 dark:hover:bg-green-800"
          )}
        >
          <PlusCircle className="h-4 w-4" />
          {t('transactions.addTransaction')}
        </Button>
        
      </div>
      <AddTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}

