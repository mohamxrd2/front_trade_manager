import type { Invoice } from '@/lib/services/invoices'
import type { ToneKey } from '@/components/waelly'

export interface InvoiceStatusDisplay {
  label: string
  tone: ToneKey
  strikethrough?: boolean
}

/**
 * Libellé + ton d'affichage d'une facture — reprend design/DESIGN.md § 7 et
 * les couleurs demandées : Brouillon (neutre), Envoyée (attention), Payée
 * (succès), En retard (danger), Annulée (neutre, texte barré).
 * `is_overdue` (calculé côté backend) prime sur le statut brut "unpaid" pour
 * ne jamais afficher "Envoyée" sur une facture en retard.
 */
export function getInvoiceStatusDisplay(invoice: Pick<Invoice, 'status' | 'is_overdue'>): InvoiceStatusDisplay {
  if (invoice.status === 'paid') return { label: 'Payée', tone: 'success' }
  if (invoice.status === 'cancelled') return { label: 'Annulée', tone: 'neutral', strikethrough: true }
  if (invoice.status === 'draft') return { label: 'Brouillon', tone: 'neutral' }
  if (invoice.status === 'overdue' || invoice.is_overdue) return { label: 'En retard', tone: 'danger' }
  return { label: 'Envoyée', tone: 'warning' }
}
