'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Users, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ClientList, ClientFormDialog } from '@/components/clients'
import { getClients, type Client } from '@/lib/services/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

export default function ClientsPage() {
  const { t } = useTranslation()

  // States
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  // Fetch clients
  const fetchClients = useCallback(async () => {
    console.log('🔄 fetchClients called')
    setIsLoading(true)
    try {
      const data = await getClients()
      console.log('✅ getClients returned:', data, 'type:', typeof data, 'isArray:', Array.isArray(data))
      setClients(data)
    } catch (error) {
      console.error('❌ Error fetching clients:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  // Filter clients by search (ensure clients is always an array)
  const clientsArray = Array.isArray(clients) ? clients : []
  const filteredClients = clientsArray.filter(
    (client) =>
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.email?.toLowerCase().includes(search.toLowerCase()) ||
      client.phone?.includes(search)
  )

  // Handle edit
  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setDialogOpen(true)
  }

  // Handle dialog close
  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingClient(null)
  }

  // Handle success (create/update)
  const handleSuccess = () => {
    fetchClients()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('clients.title')}</h1>
          <p className="text-muted-foreground">{t('clients.description')}</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('clients.addClient')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clientsArray.length}</p>
                <p className="text-sm text-muted-foreground">{t('clients.totalClients')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('clients.allClients')}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('clients.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ClientList
            clients={filteredClients}
            isLoading={isLoading}
            onEdit={handleEdit}
            onRefresh={fetchClients}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <ClientFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSuccess={handleSuccess}
        client={editingClient}
      />
    </div>
  )
}

