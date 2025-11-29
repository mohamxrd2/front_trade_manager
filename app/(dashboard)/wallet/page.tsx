'use client'

import { useState, useEffect } from 'react'
import { WalletStats } from '@/components/wallet/wallet-stats'
import { TransactionList } from '@/components/wallet/transaction-list'
import { WalletActions } from '@/components/wallet/wallet-actions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { getWalletStats, getTransactions } from '@/lib/services/transactions'
import { useTranslation } from "@/lib/i18n/hooks/useTranslation";

/**
 * Page Wallet
 * 
 * Affiche les statistiques financières, les actions et la liste des transactions
 */
export default function WalletPage() {
  const { t } = useTranslation()
  const [transactionListKey, setTransactionListKey] = useState(0)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  // Vérifier les erreurs au chargement initial
  useEffect(() => {
    const checkErrors = async () => {
      try {
        setError(null)
        await Promise.all([
          getWalletStats().catch((err) => {
            if (err instanceof Error) {
              setError(err)
              throw err
            }
          }),
          getTransactions().catch((err) => {
            if (err instanceof Error) {
              setError(err)
              throw err
            }
          }),
        ])
      } catch {
        // L'erreur est déjà définie dans setError
      } finally {
        setLoading(false)
      }
    }

    checkErrors()
  }, [])

  const handleTransactionAdded = () => {
    // Forcer le rechargement de la liste des transactions
    setTransactionListKey((prev) => prev + 1)
    // Déclencher le rechargement des statistiques
    setRefreshTrigger((prev) => prev + 1)
    // Réinitialiser l'erreur après un ajout réussi
    setError(null)
  }

  // Afficher les erreurs
  if (error) {
    // Erreur 401 : redirection automatique gérée par le service
    // Pour les autres erreurs, afficher un message
    const isAuthError = error.message.includes('Non authentifié')
    
    if (isAuthError) {
      // La redirection est déjà gérée, juste afficher un message temporaire
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">{t('errors.redirecting')}</p>
        </div>
      )
    }

    // Autres erreurs (500, réseau, etc.)
    return (
      <div className="flex flex-col gap-6 py-6 px-4 lg:px-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errors.loading')}</AlertTitle>
          <AlertDescription>
            {error.message || t('errors.loadingDescription')}
            <br />
            <span className="text-xs mt-2 block">
              {t('errors.loadingDescription')}
            </span>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <div className="px-4 lg:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
        <div className="px-4 lg:px-6">
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    )
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
