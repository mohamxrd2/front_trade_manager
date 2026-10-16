'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, Plus, Search } from 'lucide-react'

import {
  getClientsPaginated,
  getClientById,
  getInvoices,
  type Client,
  type Invoice,
} from '@/lib/services/invoices'
import { Button, Card, Pagination } from '@/components/waelly'
import { ClientDetailCard, PAYMENT_METHOD_LABELS } from '@/components/clients/client-detail-card'
import { ClientFormDialog } from '@/components/clients/client-form-dialog'

const PAGE_SIZE = 10

const formatAmount = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const initials = (name: string): string => (name.trim() ? name.trim().slice(0, 2).toUpperCase() : 'NA')

const AVATAR_TINTS = [
  { bg: 'bg-brand-100', text: 'text-brand-600' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]

/**
 * Clients — reprend design/maquettes/ordinateur/Web-Clients.dc.html
 * (≥ 1024px). Pas de maquette mobile fournie : adaptée avec les mêmes
 * règles (recherche, liste, fiche en pleine page sur /clients/[id]).
 *
 * Écarts / choix assumés :
 * - "Total facturé"/"Reste à payer"/"Client depuis" ne viennent d'aucun
 *   champ dédié de l'API : calculés ici à partir de GET /api/invoices
 *   filtré par client_id (reste à payer = factures "unpaid"/"overdue"),
 *   comme demandé explicitement en l'absence d'un tel champ.
 * - "Facturer" renvoie vers /invoices/new?client=ID, mais /invoices/new
 *   (non touché ici) ne lit actuellement aucun paramètre pour présélectionner
 *   un client — le lien fonctionne, juste sans préremplissage automatique
 *   tant que cette page-là n'est pas adaptée.
 */
export default function ClientsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams.get('id')

  const [search, setSearch] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [page, setPage] = React.useState(1)

  const [clients, setClients] = React.useState<Client[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null)
  const [loadingSelected, setLoadingSelected] = React.useState(false)

  // Toutes les factures, récupérées une seule fois (pagination suivie
  // jusqu'à épuisement) et regroupées par client : évite un aller-retour par
  // ligne pour afficher la colonne "Facturé" de chacune, et sert aussi au
  // calcul de la fiche sélectionnée (total facturé / reste à payer).
  const [allInvoices, setAllInvoices] = React.useState<Invoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = React.useState(true)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | null>(null)

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timeout)
  }, [search])

  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const fetchClients = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { clients: data, total } = await getClientsPaginated({
        search: debouncedSearch || undefined,
        page,
        per_page: PAGE_SIZE,
      })
      setClients(data)
      setTotalCount(total)
    } catch (err: unknown) {
      setError((err as Error).message || 'Impossible de charger les clients.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page])

  const fetchAllInvoices = React.useCallback(async () => {
    setLoadingInvoices(true)
    try {
      let currentPage = 1
      let all: Invoice[] = []
      for (;;) {
        const { invoices, pages } = await getInvoices({ page: currentPage, per_page: 100 })
        all = all.concat(invoices)
        if (currentPage >= pages) break
        currentPage += 1
      }
      setAllInvoices(all)
    } catch {
      setAllInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }, [])

  React.useEffect(() => {
    fetchClients()
  }, [fetchClients])

  React.useEffect(() => {
    fetchAllInvoices()
  }, [fetchAllInvoices])

  React.useEffect(() => {
    if (!selectedId && clients.length > 0) {
      router.replace(`/clients?id=${clients[0].id}`, { scroll: false })
    }
  }, [selectedId, clients, router])

  React.useEffect(() => {
    if (!selectedId) {
      setSelectedClient(null)
      return
    }
    let cancelled = false
    setLoadingSelected(true)
    getClientById(selectedId)
      .then((client) => {
        if (!cancelled) setSelectedClient(client)
      })
      .catch(() => {
        if (!cancelled) setSelectedClient(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingSelected(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const selectClient = (id: string) => {
    router.replace(`/clients?id=${id}`, { scroll: false })
  }

  const invoicesByClient = React.useMemo(() => {
    const map = new Map<string, Invoice[]>()
    allInvoices.forEach((inv) => {
      const list = map.get(inv.client_id) ?? []
      list.push(inv)
      map.set(inv.client_id, list)
    })
    return map
  }, [allInvoices])

  const billedTotalFor = React.useCallback(
    (clientId: string) =>
      (invoicesByClient.get(clientId) ?? [])
        .filter((i) => i.status !== 'draft' && i.status !== 'cancelled')
        .reduce((s, i) => s + Number(i.total), 0),
    [invoicesByClient]
  )
  const dueTotalFor = React.useCallback(
    (clientId: string) =>
      (invoicesByClient.get(clientId) ?? [])
        .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
        .reduce((s, i) => s + Number(i.total), 0),
    [invoicesByClient]
  )

  const selectedInvoices = selectedClient ? invoicesByClient.get(selectedClient.id) ?? [] : []
  const totalBilled = selectedClient ? billedTotalFor(selectedClient.id) : 0
  const amountDue = selectedClient ? dueTotalFor(selectedClient.id) : 0

  const handleFormSuccess = async (client: Client) => {
    setFormOpen(false)
    setEditingClient(null)
    await fetchClients()
    selectClient(client.id)
  }

  const handleDeleted = async () => {
    setFormOpen(false)
    setEditingClient(null)
    await fetchClients()
    router.replace('/clients', { scroll: false })
  }

  const openAdd = () => {
    setEditingClient(null)
    setFormOpen(true)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setFormOpen(true)
  }

  const emptyState = (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-subtle">
        {debouncedSearch ? `Aucun client ne correspond à "${debouncedSearch}"` : "Aucun client pour l'instant"}
      </p>
      {!debouncedSearch ? (
        <Button variant="primary" onClick={openAdd}>
          + Nouveau client
        </Button>
      ) : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* --- Mobile (< 1024px) --- */}
      <div className="flex flex-col gap-4 pb-28 lg:hidden">
        <div className="flex items-center justify-between">
          <Link
            href="/invoices"
            aria-label="Retour aux factures"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight text-ink">Clients</h1>
          <button
            type="button"
            aria-label="Nouveau client"
            onClick={openAdd}
            className="flex size-12 items-center justify-center rounded-full bg-orb text-white shadow-button"
          >
            <Plus className="size-6" strokeWidth={2} />
          </button>
        </div>

        <div className="relative flex">
          <Search className="pointer-events-none absolute left-3.5 top-3 size-[18px] text-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, e-mail"
            className="h-11 w-full rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink outline-none"
          />
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-10 text-subtle" />
            <p className="text-sm text-subtle">{error}</p>
            <Button variant="secondary" onClick={fetchClients}>
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-tile bg-surface-soft" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          emptyState
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {clients.map((c, i) => {
                const tint = AVATAR_TINTS[i % AVATAR_TINTS.length]
                const due = dueTotalFor(c.id)
                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 rounded-tile border border-line bg-surface p-3.5"
                  >
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tint.bg} ${tint.text}`}
                    >
                      {initials(c.name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15px] font-bold text-ink">{c.name}</span>
                      {c.phone ? <span className="text-[13px] text-subtle">{c.phone}</span> : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-sm font-bold text-ink">
                        {loadingInvoices ? '…' : `${formatAmount(billedTotalFor(c.id))} F`}
                      </span>
                      {!loadingInvoices && due > 0 ? (
                        <span className="text-xs font-semibold text-warning">Reste {formatAmount(due)} F</span>
                      ) : null}
                    </span>
                  </Link>
                )
              })}
            </div>
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              summary={`${clients.length} client(s) affiché(s) sur ${totalCount}`}
            />
          </>
        )}
      </div>

      {/* --- Ordinateur (≥ 1024px) --- */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">Clients</h1>
            <span className="text-sm text-subtle">Votre annuaire pour facturer plus vite</span>
          </div>
          <Button variant="primary" onClick={openAdd}>
            <Plus className="size-[18px]" strokeWidth={2.2} />
            Nouveau client
          </Button>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <Card className="flex flex-[3_1_480px] flex-col gap-3.5 rounded-panel">
            <div className="relative flex">
              <Search className="pointer-events-none absolute left-3.5 top-3 size-[18px] text-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, téléphone, e-mail"
                className="h-11 w-full rounded-full border border-line bg-canvas pl-10 pr-4 text-sm text-ink outline-none"
              />
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertCircle className="size-10 text-subtle" />
                <p className="text-sm text-subtle">{error}</p>
                <Button variant="secondary" onClick={fetchClients}>
                  Réessayer
                </Button>
              </div>
            ) : loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              emptyState
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-subtle">
                        <th className="px-2 py-2.5">Client</th>
                        <th className="px-2 py-2.5">Contact</th>
                        <th className="px-2 py-2.5">Paiement</th>
                        <th className="px-2 py-2.5 text-right">Facturé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c, i) => {
                        const active = c.id === selectedId
                        const tint = AVATAR_TINTS[i % AVATAR_TINTS.length]
                        return (
                          <tr
                            key={c.id}
                            onClick={() => selectClient(c.id)}
                            className={`cursor-pointer border-t border-divider ${active ? 'bg-brand-50' : ''}`}
                          >
                            <td className="px-2 py-0">
                              <button
                                type="button"
                                aria-pressed={active}
                                className="flex min-h-[56px] w-full items-center gap-2.5 bg-transparent text-left"
                              >
                                <span
                                  className={`flex size-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${tint.bg} ${tint.text}`}
                                >
                                  {initials(c.name)}
                                </span>
                                <span className="text-sm font-bold text-ink">{c.name}</span>
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-2 py-0 text-ink-3">{c.phone || '—'}</td>
                            <td className="px-2 py-0 text-ink-3">
                              {c.payment_method ? PAYMENT_METHOD_LABELS[c.payment_method] : '—'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-0 text-right font-bold text-ink">
                              {loadingInvoices ? '…' : `${formatAmount(billedTotalFor(c.id))} F`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  summary={`${clients.length} client(s) affiché(s) sur ${totalCount}`}
                />
              </>
            )}
          </Card>

          <aside aria-label="Fiche client" className="glass-panel flex flex-[2_1_340px] flex-col gap-4 rounded-panel p-5">
            {loadingSelected || !selectedClient ? (
              <div className="h-[460px] animate-pulse rounded-tile bg-surface-soft" />
            ) : (
              <>
                <ClientDetailCard
                  client={selectedClient}
                  invoices={selectedInvoices}
                  totalBilled={totalBilled}
                  amountDue={amountDue}
                />
                <div className="flex gap-2.5">
                  <Button variant="secondary" className="flex-1" onClick={() => openEdit(selectedClient)}>
                    Modifier
                  </Button>
                  <Button variant="black" className="flex-1" asChild>
                    <Link href={`/invoices/new?client=${selectedClient.id}`}>Facturer</Link>
                  </Button>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      <ClientFormDialog
        open={formOpen}
        client={editingClient}
        invoicesCount={editingClient ? (invoicesByClient.get(editingClient.id)?.length ?? editingClient.invoices_count ?? 0) : 0}
        onClose={() => {
          setFormOpen(false)
          setEditingClient(null)
        }}
        onSuccess={handleFormSuccess}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
