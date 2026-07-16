import { useSettings } from '@/contexts/SettingsContext'

/**
 * Formate un montant avec la devise de l'utilisateur
 */
export function formatCurrency(amount: number | string, currency?: string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return '0'
  }

  const currencySymbol = currency || 'FCFA'
  
  // Formater le nombre avec des espaces pour les milliers
  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount)

  // Retourner selon la devise
  switch (currencySymbol) {
    case 'EUR':
      return `${formattedAmount} €`
    case 'USD':
      return `$${formattedAmount}`
    case 'GBP':
      return `£${formattedAmount}`
    case 'JPY':
      return `¥${formattedAmount}`
    case 'CNY':
      return `¥${formattedAmount}`
    case 'INR':
      return `₹${formattedAmount}`
    case 'BRL':
      return `R$ ${formattedAmount}`
    case 'CAD':
      return `C$${formattedAmount}`
    case 'AUD':
      return `A$${formattedAmount}`
    case 'CHF':
      return `${formattedAmount} CHF`
    case 'NGN':
      return `₦${formattedAmount}`
    case 'ZAR':
      return `R ${formattedAmount}`
    case 'EGP':
      return `E£${formattedAmount}`
    case 'XOF':
      return `${formattedAmount} XOF`
    case 'FCFA':
    default:
      return `${formattedAmount} FCFA`
  }
}

/**
 * Hook pour formater les montants avec la devise de l'utilisateur
 */
export function useCurrency() {
  const { settings } = useSettings()
  
  return {
    format: (amount: number | string) => formatCurrency(amount, settings?.currency),
    currency: settings?.currency || 'FCFA',
  }
}

