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
import { createCollaborator } from '@/lib/services/collaborators'

const collaboratorSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(255, "Le nom ne peut pas dépasser 255 caractères"),
  phone: z.string().min(1, "Le téléphone est requis").max(20, "Le téléphone ne peut pas dépasser 20 caractères"),
  part: z.string().transform((val) => {
    const num = parseFloat(val)
    if (isNaN(num) || num < 0.01 || num > 99.99) {
      throw new Error("La part doit être entre 0.01% et 99.99%")
    }
    return num
  }),
})

interface AddCollaboratorDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  user: { company_share: number } | null
}

export function AddCollaboratorDialog({
  open,
  onClose,
  onSuccess,
  user,
}: AddCollaboratorDialogProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<{
    name: string
    phone: string
    part: string
  }>({
    resolver: zodResolver(collaboratorSchema),
    defaultValues: {
      name: '',
      phone: '',
      part: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        phone: '',
        part: '',
      })
    }
  }, [open, form])

  const onSubmit = async (data: { name: string; phone: string; part: string }) => {
    // Convertir part en nombre
    const partNum = parseFloat(data.part)
    
    // Validation côté client : part ≤ company_share
    if (user && partNum > user.company_share) {
      form.setError('part', {
        message: `La part ne peut pas dépasser ${user.company_share.toFixed(2)}% (part disponible)`,
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: data.name,
        phone: data.phone,
        part: partNum,
        image: null,
      }

      await createCollaborator(payload)

      toast.success('Collaborateur ajouté avec succès')
      form.reset()
      onClose()
      onSuccess() // Appeler onSuccess pour recharger la liste
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'validationErrors' in error) {
        const validationError = error as { validationErrors: Record<string, string[]> }
        Object.keys(validationError.validationErrors).forEach(key => {
          form.setError(key as any, { 
            message: validationError.validationErrors[key][0] 
          })
        })
      } else if (error instanceof Error) {
        toast.error(error.message || 'Erreur lors de la création du collaborateur')
      } else {
        toast.error('Erreur lors de la création du collaborateur')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajouter un collaborateur</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              placeholder="Ex: Jean Dupont"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone *</Label>
            <Input
              id="phone"
              placeholder="Ex: +33 6 12 34 56 78"
              {...form.register('phone')}
            />
            {form.formState.errors.phone && (
              <p className="text-sm text-red-500">{form.formState.errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="part">Part (%) *</Label>
            <Input
              id="part"
              type="number"
              step="0.01"
              min="0.01"
              max={user?.company_share || 99.99}
              placeholder="Ex: 25.50"
              {...form.register('part')}
            />
            <p className="text-sm text-muted-foreground">
              Part disponible : {user?.company_share.toFixed(2) || '0.00'}%
            </p>
            {form.formState.errors.part && (
              <p className="text-sm text-red-500">{form.formState.errors.part.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

