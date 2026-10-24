import { useQuery } from '@tanstack/react-query'

import { keys } from '@/lib/query-keys'
import { getInvoices } from '@/lib/services/invoices'

export interface InvoiceLookupEntry {
  invoice_number: string
  status: string
  client_name: string | null
}

/**
 * Table de correspondance invoice_id → { numéro, statut, client }, pour
 * résoudre ce qu'une transaction.invoice_id ne porte pas elle-même (GET
 * /api/transactions ne renvoie pas ces champs). Boucle de pagination
 * reprise de wallet/page.tsx (avant : dupliquée localement) — maintenant
 * partagée par le Portefeuille ET les sheets/dialogs de détail de
 * transaction, pour décider côté UI si une vente est liée à une facture
 * payée (bouton "Voir la facture" au lieu de "Supprimer").
 */
async function fetchAllInvoices(): Promise<Record<string, InvoiceLookupEntry>> {
  const map: Record<string, InvoiceLookupEntry> = {}
  let current = 1
  for (;;) {
    const { invoices, pages } = await getInvoices({ page: current, per_page: 100 })
    invoices.forEach((inv) => {
      map[inv.id] = {
        invoice_number: inv.invoice_number,
        status: inv.status,
        client_name: inv.client?.name ?? null,
      }
    })
    if (current >= pages) break
    current += 1
  }
  return map
}

export function useInvoiceLookup() {
  const { data } = useQuery({
    queryKey: keys.invoices.lookup(),
    queryFn: fetchAllInvoices,
    // La colonne/ligne Facture retombe sur "—" si ça échoue — pas critique.
    retry: false,
  })

  return data ?? {}
}
