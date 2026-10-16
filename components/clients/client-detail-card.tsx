import Link from 'next/link'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

import type { Client, ClientPaymentMethod, Invoice } from '@/lib/services/invoices'
import { getInvoiceStatusDisplay } from '@/components/invoices/invoice-status'
import { StatusBadge } from '@/components/waelly'

dayjs.locale('fr')

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const initials = (name: string): string => (name.trim() ? name.trim().slice(0, 2).toUpperCase() : 'NA')

export const PAYMENT_METHOD_LABELS: Record<ClientPaymentMethod, string> = {
  cash: 'Espèces',
  credit_card: 'Carte bancaire',
  bank_transfer: 'Virement',
  cheque: 'Chèque',
  mobile_money: 'Mobile Money',
  other: 'Autre',
}

interface ClientDetailCardProps {
  client: Client
  /** Jusqu'à 10 dernières factures du client (déjà triées, desc) */
  invoices: Invoice[]
  totalBilled: number
  amountDue: number
}

/**
 * Fiche client — design/maquettes/ordinateur/Web-Clients.dc.html § Fiche
 * client. Utilisée à la fois dans le panneau "Aperçu" (ordinateur) et en
 * pleine page sur /clients/[id] (mobile).
 */
export function ClientDetailCard({ client, invoices, totalBilled, amountDue }: ClientDetailCardProps) {
  const recentInvoices = invoices.slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-orb text-lg font-extrabold text-white">
          {initials(client.name)}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-xl font-extrabold text-ink">{client.name}</span>
          <span className="text-[13px] text-subtle">Client depuis {dayjs(client.created_at).format('MMMM YYYY')}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-tile bg-surface p-3">
          <span className="text-xs text-subtle">Total facturé</span>
          <span className="text-[17px] font-bold text-ink">{formatAmount(totalBilled)} F</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-tile bg-surface p-3">
          <span className="text-xs text-subtle">Reste à payer</span>
          <span className={`text-[17px] font-bold ${amountDue > 0 ? 'text-warning' : 'text-success-strong'}`}>
            {formatAmount(amountDue)} F
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
        <dt className="text-subtle">Téléphone</dt>
        <dd className="font-semibold text-ink">
          {client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : '—'}
        </dd>
        <dt className="text-subtle">E-mail</dt>
        <dd className="font-semibold text-ink">
          {client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}
        </dd>
        <dt className="text-subtle">Paiement</dt>
        <dd className="font-semibold text-ink">
          {client.payment_method ? PAYMENT_METHOD_LABELS[client.payment_method] : '—'}
        </dd>
        <dt className="text-subtle">Facturation</dt>
        <dd className="font-semibold text-ink">{client.billing_address || '—'}</dd>
        <dt className="text-subtle">Livraison</dt>
        <dd className="font-semibold text-ink">{client.shipping_address || '—'}</dd>
      </dl>

      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-bold text-ink">Dernières factures</span>
        {recentInvoices.length === 0 ? (
          <p className="py-2 text-sm text-subtle">Aucune facture pour l&apos;instant</p>
        ) : (
          recentInvoices.map((inv) => {
            const statusDisplay = getInvoiceStatusDisplay(inv)
            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2.5 border-b border-line py-2 text-sm last:border-0"
              >
                <Link href={`/invoices/${inv.id}`} className="font-semibold text-brand-700">
                  {inv.invoice_number}
                </Link>
                <StatusBadge
                  tone={statusDisplay.tone}
                  label={statusDisplay.label}
                  className={statusDisplay.strikethrough ? 'line-through' : ''}
                />
                <span className="font-bold text-ink">{formatAmount(Number(inv.total))} F</span>
              </div>
            )
          })
        )}
        <Link href={`/invoices?client=${client.id}`} className="pt-1 text-[13px] font-semibold text-brand-700">
          Voir toutes ses factures
        </Link>
      </div>
    </div>
  )
}
