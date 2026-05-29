'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, User, Mail, Phone, CreditCard, MapPin } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient, updateClient, type Client, type CreateClientPayload } from '@/lib/services/invoices'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const clientSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide').nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional().or(z.literal('')),
  payment_method: z.enum(['cash', 'bank_transfer', 'mobile_money', 'card', 'other']).nullable().optional(),
  billing_address: z.string().nullable().optional().or(z.literal('')),
  shipping_address: z.string().nullable().optional().or(z.literal('')),
})

type ClientFormData = z.infer<typeof clientSchema>

// ============================================================================
// PROPS
// ============================================================================

interface ClientFormDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: (client: Client) => void
  client?: Client | null // Si fourni, mode édition
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ClientFormDialog({ open, onClose, onSuccess, client }: ClientFormDialogProps) {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = Boolean(client)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      payment_method: null,
      billing_address: '',
      shipping_address: '',
    },
  })

  // Remplir le formulaire en mode édition
  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        payment_method: client.payment_method,
        billing_address: client.billing_address || '',
        shipping_address: client.shipping_address || '',
      })
    } else {
      reset({
        name: '',
        email: '',
        phone: '',
        payment_method: null,
        billing_address: '',
        shipping_address: '',
      })
    }
  }, [client, reset])

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true)

    try {
      const payload: CreateClientPayload = {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        payment_method: data.payment_method || null,
        billing_address: data.billing_address || null,
        shipping_address: data.shipping_address || null,
      }

      let result: Client

      if (isEditing && client) {
        result = await updateClient(client.id, payload)
        toast.success(t('clients.clientUpdated'))
      } else {
        result = await createClient(payload)
        toast.success(t('clients.clientCreated'))
      }

      // Fermer le dialog d'abord
      reset()
      onClose()
      
      // Puis appeler onSuccess pour rafraîchir la liste
      onSuccess(result)
    } catch (error: any) {
      // Afficher le message du backend
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t('clients.saveError')

      // Gérer les erreurs de validation 422
      if (error.response?.status === 422 && error.response?.data?.errors) {
        const errors = error.response.data.errors
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : message)
      } else {
        toast.error(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      reset()
      onClose()
    }
  }

  const paymentMethod = watch('payment_method')

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {isEditing ? t('clients.editClient') : t('clients.addClient')}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t('clients.editClientDescription') : t('clients.addClientDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {t('clients.name')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder={t('clients.namePlaceholder')}
              className={errors.name ? 'border-destructive' : ''}
              {...register('name')}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email & Téléphone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {t('clients.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('clients.emailPlaceholder')}
                className={errors.email ? 'border-destructive' : ''}
                {...register('email')}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {t('clients.phone')}
              </Label>
              <Input
                id="phone"
                placeholder={t('clients.phonePlaceholder')}
                {...register('phone')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Méthode de paiement */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              {t('clients.paymentMethod')}
            </Label>
            <Select
              value={paymentMethod || ''}
              onValueChange={(value) => setValue('payment_method', value as CreateClientPayload['payment_method'])}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('clients.selectPaymentMethod')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('clients.paymentMethods.cash')}</SelectItem>
                <SelectItem value="bank_transfer">{t('clients.paymentMethods.bankTransfer')}</SelectItem>
                <SelectItem value="mobile_money">{t('clients.paymentMethods.mobileMoney')}</SelectItem>
                <SelectItem value="card">{t('clients.paymentMethods.card')}</SelectItem>
                <SelectItem value="other">{t('clients.paymentMethods.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Adresse de facturation */}
          <div className="space-y-2">
            <Label htmlFor="billing_address" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {t('clients.billingAddress')}
            </Label>
            <Textarea
              id="billing_address"
              placeholder={t('clients.billingAddressPlaceholder')}
              rows={2}
              {...register('billing_address')}
              disabled={isSubmitting}
            />
          </div>

          {/* Adresse de livraison */}
          <div className="space-y-2">
            <Label htmlFor="shipping_address" className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {t('clients.shippingAddress')}
            </Label>
            <Textarea
              id="shipping_address"
              placeholder={t('clients.shippingAddressPlaceholder')}
              rows={2}
              {...register('shipping_address')}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                isEditing ? t('common.save') : t('common.add')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

