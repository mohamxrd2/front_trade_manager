'use client'

import { useState, useEffect } from 'react'
import { User, Plus, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getClients, type Client } from '@/lib/services/invoices'
import { ClientFormDialog } from '@/components/clients/client-form-dialog'
import { useInvoiceForm } from './invoice-form-context'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

export function StepClient() {
  const { t } = useTranslation()
  const { formData, updateFormData } = useInvoiceForm()
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  const fetchClients = async () => {
    setIsLoading(true)
    try {
      const data = await getClients()
      setClients(data)
    } catch (error) {
      console.error('Error fetching clients:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectClient = (client: Client) => {
    updateFormData({
      client,
      billingAddress: client.billing_address || '',
      shippingAddress: client.shipping_address || '',
    })
  }

  const handleClientCreated = (newClient: Client) => {
    setClients((prev) => [...prev, newClient])
    handleSelectClient(newClient)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder={t('invoices.searchClient')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="outline"
          onClick={() => setAddDialogOpen(true)}
          className="shrink-0"
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('clients.addClient')}
        </Button>
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {clients.length === 0 ? t('clients.noClients') : t('invoices.noMatchingClients')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((client) => {
            const isSelected = formData.client?.id === client.id

            return (
              <Card
                key={client.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  isSelected && 'ring-2 ring-green-500 bg-green-50 dark:bg-green-950/20'
                )}
                onClick={() => handleSelectClient(client)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center',
                        isSelected ? 'bg-green-500 text-white' : 'bg-primary/10'
                      )}>
                        {isSelected ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">{client.name}</h3>
                        {client.email && (
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        )}
                        {client.phone && (
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Badge className="bg-green-500 text-white">
                        {t('common.selected')}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ClientFormDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={handleClientCreated}
      />
    </div>
  )
}

