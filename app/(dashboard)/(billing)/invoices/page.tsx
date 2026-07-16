'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  InvoiceDashboardCards,
  InvoiceTable,
  InvoiceFilters,
} from '@/components/invoices'
import {
  getInvoiceDashboard,
  getInvoices,
  getClients,
  type InvoiceDashboardStats,
  type Invoice,
  type Client,
  type InvoiceStatus,
} from '@/lib/services/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

// ============================================================================
// FILTERS TYPE
// ============================================================================

interface Filters {
  search?: string
  status?: InvoiceStatus | 'all'
  client_id?: string | 'all'
}

// ============================================================================
// PAGE CONTENT
// ============================================================================

function InvoicesPageContent() {
  const router = useRouter()
  const { t } = useTranslation()

  // States
  const [stats, setStats] = useState<InvoiceDashboardStats | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true)
  const [filters, setFilters] = useState<Filters>({})

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const data = await getInvoiceDashboard()
      if (process.env.NODE_ENV !== 'production') {
        console.debug('📊 fetchStats result:', data)
      }
      setStats(data)
    } catch (error) {
      console.error('❌ Error fetching stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  // Fetch invoices with filters
  const fetchInvoices = useCallback(async () => {
    setIsLoadingInvoices(true)
    try {
      const params: Parameters<typeof getInvoices>[0] = {}

      if (filters.search) {
        params.search = filters.search
      }
      if (filters.status && filters.status !== 'all') {
        params.status = filters.status
      }
      if (filters.client_id && filters.client_id !== 'all') {
        params.client_id = filters.client_id
      }

      const result = await getInvoices(params)
      
      // Debug log
      if (process.env.NODE_ENV !== 'production') {
        console.debug('📦 fetchInvoices result:', result)
      }
      
      setInvoices(Array.isArray(result.invoices) ? result.invoices : [])
    } catch (error) {
      console.error('❌ Error fetching invoices:', error)
      setInvoices([])
    } finally {
      setIsLoadingInvoices(false)
    }
  }, [filters])

  // Fetch clients for filter dropdown
  const fetchClients = useCallback(async () => {
    try {
      const data = await getClients()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchStats()
    fetchInvoices()
    fetchClients()
  }, [fetchStats, fetchInvoices, fetchClients])

  // Handle filter change
  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters)
  }

  // Refresh data
  const handleRefresh = () => {
    fetchStats()
    fetchInvoices()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('invoices.title')}</h1>
          <p className="text-muted-foreground">{t('invoices.description')}</p>
        </div>
        <Button
          onClick={() => router.push('/invoices/new')}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('invoices.newInvoice')}
        </Button>
      </div>

      {/* Dashboard Cards */}
      <InvoiceDashboardCards stats={stats} isLoading={isLoadingStats} />

      {/* Invoices Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('invoices.allInvoices')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <InvoiceFilters clients={clients} onFilterChange={handleFilterChange} />

          {/* Table */}
          <InvoiceTable
            invoices={invoices}
            isLoading={isLoadingInvoices}
            onRefresh={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// PAGE EXPORT
// ============================================================================

export default function InvoicesPage() {
  return <InvoicesPageContent />
}

