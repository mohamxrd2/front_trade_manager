'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateCollaborator, type Collaborator } from '@/lib/services/collaborators'

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const editCollaboratorSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(255, "Le nom ne peut pas dépasser 255 caractères"),
  phone: z.string().min(1, "Le téléphone est requis").max(20, "Le téléphone ne peut pas dépasser 20 caractères"),
})

interface EditCollaboratorDialogProps {
  collaborator: Collaborator
  open: boolean
  onClose: () => void
  onSuccess: (collaborator: Collaborator) => void
}

export function EditCollaboratorDialog({
  collaborator,
  open,
  onClose,
  onSuccess,
}: EditCollaboratorDialogProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<{
    name: string
    phone: string
  }>({
    resolver: zodResolver(editCollaboratorSchema),
    defaultValues: {
      name: '',
      phone: '',
    },
  })

  useEffect(() => {
    if (collaborator && open) {
      form.reset({
        name: collaborator.name,
        phone: collaborator.phone,
      })
    }
  }, [collaborator, open, form])

  const onSubmit = async (data: { name: string; phone: string }) => {
    setLoading(true)
    try {
      const payload = {
        name: data.name,
        phone: data.phone,
        image: null,
      }

      const updatedCollaborator = await updateCollaborator(collaborator.id, payload)

      toast.success('Collaborateur modifié avec succès')
      onSuccess(updatedCollaborator)
      onClose()
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'validationErrors' in error) {
        const validationError = error as { validationErrors: Record<string, string[]> }
        Object.keys(validationError.validationErrors).forEach(key => {
          form.setError(key as any, { 
            message: validationError.validationErrors[key][0] 
          })
        })
      } else if (error instanceof Error) {
        toast.error(error.message || 'Erreur lors de la modification')
      } else {
        toast.error('Erreur lors de la modification')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier le collaborateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom *</Label>
            <Input
              id="edit-name"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Téléphone *</Label>
            <Input
              id="edit-phone"
              {...form.register('phone')}
            />
            {form.formState.errors.phone && (
              <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
            )}
          </div>

          {/* Part en lecture seule */}
          <div className="space-y-2">
            <Label>Part (%)</Label>
            <Input
              value={collaborator.part}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              La part ne peut pas être modifiée après création
            </p>
          </div>

          {/* Wallet en lecture seule */}
          <div className="space-y-2">
            <Label>Wallet</Label>
            <Input
              value={formatCurrency(collaborator.wallet)}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              Le wallet est calculé automatiquement
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Modification...' : 'Modifier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

