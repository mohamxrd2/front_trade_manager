'use client'

import { useState } from 'react'
import { WalletStats } from '@/components/wallet/wallet-stats'
import { TransactionList } from '@/components/wallet/transaction-list'
import { WalletActions } from '@/components/wallet/wallet-actions'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";

/**
 * Page Wallet
 * 
 * Affiche les statistiques financières, les actions et la liste des transactions
 * Les composants enfants (WalletStats, TransactionList) gèrent leurs propres états de chargement
 */
export default function WalletPage() {
  const { t } = useTranslation()
  const [transactionListKey, setTransactionListKey] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleTransactionAdded = () => {
    // Forcer le rechargement de la liste des transactions
    setTransactionListKey((prev) => prev + 1)
    // Déclencher le rechargement des statistiques
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* En-tête avec 4 cards de statistiques */}
      <WalletStats refreshTrigger={refreshTrigger} />

      {/* Zone de recherche + filtres + Liste des transactions */}
      <div className="px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">{t('transactions.title')}</h2>
          <WalletActions onTransactionAdded={handleTransactionAdded} />
        </div>
        <TransactionList key={transactionListKey} refreshKey={transactionListKey} onTransactionAdded={handleTransactionAdded} />
      </div>
    </div>
  )
}
