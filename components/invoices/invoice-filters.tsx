'use client'

import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { InvoiceStatus, Client } from '@/lib/services/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface InvoiceFiltersProps {
  clients: Client[]
  onFilterChange: (filters: {
    search?: string
    status?: InvoiceStatus | 'all'
    client_id?: string | 'all'
  }) => void
}

export function InvoiceFilters({ clients, onFilterChange }: InvoiceFiltersProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [clientId, setClientId] = useState<string | 'all'>('all')

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange({ search: value, status, client_id: clientId })
  }

  const handleStatusChange = (value: InvoiceStatus | 'all') => {
    setStatus(value)
    onFilterChange({ search, status: value, client_id: clientId })
  }

  const handleClientChange = (value: string) => {
    setClientId(value)
    onFilterChange({ search, status, client_id: value })
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setClientId('all')
    onFilterChange({ search: '', status: 'all', client_id: 'all' })
  }

  const hasActiveFilters = search || status !== 'all' || clientId !== 'all'
  const activeFilterCount = [search, status !== 'all', clientId !== 'all'].filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Recherche */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('invoices.searchPlaceholder')}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtre statut */}
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('invoices.filterByStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="draft">{t('invoices.pdf.status_draft')}</SelectItem>
            <SelectItem value="pending">{t('invoices.status.pending')}</SelectItem>
            <SelectItem value="paid">{t('invoices.pdf.status_paid')}</SelectItem>
            <SelectItem value="overdue">{t('invoices.pdf.status_overdue')}</SelectItem>
            <SelectItem value="cancelled">{t('invoices.pdf.status_cancelled')}</SelectItem>
          </SelectContent>
        </Select>

        {/* Filtre client */}
        <Select value={clientId} onValueChange={handleClientChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('invoices.filterByClient')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('invoices.allClients')}</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bouton clear */}
        {hasActiveFilters && (
          <Button variant="outline" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Indicateur filtres actifs */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('invoices.activeFilters')}:
          </span>
          <Badge variant="secondary">{activeFilterCount}</Badge>
        </div>
      )}
    </div>
  )
}

