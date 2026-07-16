import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import api from '@/lib/api'

/**
 * Exporte des données en CSV
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    throw new Error('Aucune donnée à exporter')
  }

  // Obtenir les en-têtes depuis les clés du premier objet
  const headers = Object.keys(data[0])
  
  // Créer les lignes CSV
  const csvRows = [
    // En-têtes
    headers.join(','),
    // Données
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Gérer les valeurs qui contiennent des virgules ou des guillemets
        if (value === null || value === undefined) {
          return ''
        }
        const stringValue = String(value)
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(',')
    )
  ]

  // Créer le contenu CSV
  const csvContent = csvRows.join('\n')
  
  // Créer le blob et télécharger
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM pour Excel
  saveAs(blob, `${filename}.csv`)
}

/**
 * Exporte des données en Excel
 */
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  if (!data || data.length === 0) {
    throw new Error('Aucune donnée à exporter')
  }

  // Créer un nouveau workbook
  const workbook = XLSX.utils.book_new()
  
  // Convertir les données en worksheet
  const worksheet = XLSX.utils.json_to_sheet(data)
  
  // Ajouter le worksheet au workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  // Générer le fichier Excel et télécharger
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}.xlsx`)
}

/**
 * Formate un montant avec la devise
 */
function formatCurrency(amount: number | string, currency: string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  if (isNaN(numAmount)) {
    return '0'
  }

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numAmount)

  switch (currency) {
    case 'EUR':
      return `${formattedAmount} €`
    case 'USD':
      return `$${formattedAmount}`
    case 'XOF':
      return `${formattedAmount} XOF`
    case 'FCFA':
    default:
      return `${formattedAmount} FCFA`
  }
}

/**
 * Formate les transactions pour l'export
 */
export function formatTransactionsForExport(transactions: any[], currency: string = 'FCFA'): any[] {
  return transactions.map(transaction => ({
    'ID': transaction.id,
    'Type': transaction.type === 'sale' ? 'Vente' : 'Dépense',
    'Nom': transaction.name || transaction.article?.name || '-',
    'Article': transaction.article?.name || '-',
    'Variation': transaction.variation?.name || '-',
    'Quantité': transaction.quantity || 0,
    'Prix unitaire': transaction.sale_price || (transaction.quantity ? transaction.amount / transaction.quantity : 0),
    'Montant': formatCurrency(transaction.amount, currency),
    'Date': new Date(transaction.created_at).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    'Créé le': new Date(transaction.created_at).toLocaleString('fr-FR'),
  }))
}

/**
 * Formate les produits pour l'export
 */
export function formatProductsForExport(products: any[], currency: string = 'FCFA'): any[] {
  return products.map(product => ({
    'ID': product.id,
    'Nom': product.name,
    'Type': product.type === 'simple' ? 'Simple' : 'Variable',
    'Prix de vente': formatCurrency(product.sale_price, currency),
    'Quantité initiale': product.quantity,
    'Quantité vendue': product.sold_quantity || 0,
    'Quantité restante': product.remaining_quantity || 0,
    'Pourcentage vendu': `${product.sales_percentage || 0}%`,
    'Stock faible': product.low_stock ? 'Oui' : 'Non',
    'Valeur du stock': formatCurrency(product.stock_value || 0, currency),
    'Image': product.image || '-',
    'Créé le': product.created_at ? new Date(product.created_at).toLocaleString('fr-FR') : '-',
    'Modifié le': product.updated_at ? new Date(product.updated_at).toLocaleString('fr-FR') : '-',
  }))
}

