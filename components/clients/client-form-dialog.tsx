'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, X } from 'lucide-react'

import { Dialog } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient, updateClient, deleteClient, type Client, type CreateClientPayload } from '@/lib/services/invoices'
import { invalidateClients } from '@/lib/invalidate'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { Button, FilterChips } from '@/components/waelly'

function buildClientSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z.object({
    name: z.string().min(1, t('clients.form.validationNameRequired')),
    phone: z.string().optional(),
    email: z
      .string()
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), t('clients.form.validationEmailInvalid')),
    billing_address: z.string().optional(),
    shipping_address: z.string().optional(),
  })
}

type ClientFormValues = z.infer<ReturnType<typeof buildClientSchema>>

function buildPaymentChips(t: ReturnType<typeof useTranslation>['t']) {
  const desktop = [
    { value: 'cash', label: t('clients.paymentMethods.cash') },
    { value: 'mobile_money', label: t('clients.paymentMethods.mobileMoney') },
    { value: 'bank_transfer', label: t('clients.paymentMethods.bankTransfer') },
    { value: 'cheque', label: t('clients.paymentMethods.cheque') },
    { value: 'credit_card', label: t('clients.paymentMethods.creditCard') },
  ]
  const mobile = desktop.map((chip) =>
    chip.value === 'credit_card' ? { ...chip, label: t('clients.paymentMethods.creditCardShort') } : chip
  )
  return { desktop, mobile }
}

// Reprend exactement la règle de Vente/mobile/AjoutClient.dc.html :
// /^(m\.|mme|mlle)$/i — ignore ces mots avant de prendre les initiales.
function initialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^(m\.|mme|mlle)$/i.test(w))
  if (words.length === 0) return '?'
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}

interface ClientFormDialogProps {
  open: boolean
  client?: Client | null
  /** Nombre de factures liées — pour un message de confirmation précis */
  invoicesCount?: number
  /** Masque "Enregistrer et facturer" (ex. quand on est déjà sur /invoices/new) */
  showInvoiceAction?: boolean
  onClose: () => void
  onSuccess: (client: Client) => void
  onDeleted?: () => void
}

/**
 * Formulaire client (ajout/modification) — design/maquettes/ordinateur/
 * Web-NouveauClient.dc.html (Dialog ancré en haut sur ordinateur) et
 * design/maquettes/mobile/AjoutClient.dc.html (écran plein, barre d'actions
 * en verre en bas).
 */
export function ClientFormDialog({
  open,
  client,
  invoicesCount = 0,
  showInvoiceAction = true,
  onClose,
  onSuccess,
  onDeleted,
}: ClientFormDialogProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const isEditing = Boolean(client)

  const clientSchema = React.useMemo(() => buildClientSchema(t), [t])
  const paymentChips = React.useMemo(() => buildPaymentChips(t), [t])

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [paymentMethod, setPaymentMethod] = React.useState('')
  const [sameAsBilling, setSameAsBilling] = React.useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', phone: '', email: '', billing_address: '', shipping_address: '' },
  })

  const name = watch('name')
  const billingAddress = watch('billing_address')
  const ini = initialsFromName(name || '')

  React.useEffect(() => {
    if (!open) return
    reset({
      name: client?.name ?? '',
      phone: client?.phone ?? '',
      email: client?.email ?? '',
      billing_address: client?.billing_address ?? '',
      shipping_address: client?.shipping_address ?? '',
    })
    setPaymentMethod(client?.payment_method ?? '')
    setSameAsBilling(
      !client?.shipping_address || client.shipping_address === client.billing_address
    )
  }, [open, client, reset])

  React.useEffect(() => {
    if (sameAsBilling) setValue('shipping_address', billingAddress ?? '')
  }, [sameAsBilling, billingAddress, setValue])

  const handleClose = () => {
    if (!isSubmitting) onClose()
  }

  const buildPayload = (data: ClientFormValues): CreateClientPayload => ({
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    payment_method: (paymentMethod || null) as CreateClientPayload['payment_method'],
    billing_address: data.billing_address?.trim() || null,
    shipping_address: (sameAsBilling ? data.billing_address : data.shipping_address)?.trim() || null,
  })

  const saveClient = async (data: ClientFormValues): Promise<Client> => {
    const payload = buildPayload(data)
    const result = isEditing && client ? await updateClient(client.id, payload) : await createClient(payload)
    invalidateClients()
    return result
  }

  const onSubmitSave = async (data: ClientFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await saveClient(data)
      toast.success(isEditing ? t('clients.form.toastUpdated') : t('clients.form.toastAdded'))
      onSuccess(result)
    } catch (err: unknown) {
      const error = err as Error & { errors?: Record<string, string[]> }
      if (error.errors) {
        const first = Object.values(error.errors)[0]
        toast.error(Array.isArray(first) ? first[0] : error.message)
      } else {
        toast.error(error.message || t('clients.form.errorSaveFailed'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmitAndInvoice = async (data: ClientFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await saveClient(data)
      toast.success(t('clients.form.toastAdded'))
      onSuccess(result)
      router.push(`/invoices/new?client=${result.id}`)
    } catch (err: unknown) {
      const error = err as Error & { errors?: Record<string, string[]> }
      if (error.errors) {
        const first = Object.values(error.errors)[0]
        toast.error(Array.isArray(first) ? first[0] : error.message)
      } else {
        toast.error(error.message || t('clients.form.errorSaveFailed'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!client) return
    setIsDeleting(true)
    try {
      await deleteClient(client.id)
      invalidateClients()
      toast.success(t('clients.form.toastDeleted'))
      setDeleteDialogOpen(false)
      onDeleted?.()
    } catch (err: unknown) {
      toast.error((err as Error).message || t('clients.form.errorDeleteFailed'))
    } finally {
      setIsDeleting(false)
    }
  }

  const inputErrorClass = (hasError?: boolean) =>
    hasError ? 'border-[2px] border-danger' : 'border border-line-strong'

  const offerInvoiceAction = showInvoiceAction && !isEditing

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-canvas data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:bg-[rgba(14,14,26,0.42)] lg:backdrop-blur-[4px]" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-canvas outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:inset-x-0 lg:top-[72px] lg:bottom-auto lg:left-1/2 lg:mx-auto lg:w-full lg:max-w-[620px] lg:-translate-x-1/2 lg:translate-y-0 lg:overflow-visible lg:rounded-[28px] lg:bg-surface lg:p-7 lg:shadow-[0_40px_90px_rgba(10,10,60,0.35)] lg:data-[state=closed]:zoom-out-95 lg:data-[state=open]:zoom-in-95"
          >
            {/* --- En-tête mobile --- */}
            <div className="flex items-center gap-3 px-5 pb-3 pt-[52px] lg:hidden">
              <button
                type="button"
                onClick={handleClose}
                aria-label={t('clients.form.backAria')}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
              >
                <ArrowLeft className="size-[22px]" />
              </button>
              <DialogPrimitive.Title className="flex-1 text-[22px] font-bold tracking-[-0.01em] text-ink">
                {isEditing ? t('clients.form.editTitle') : t('clients.form.newTitle')}
              </DialogPrimitive.Title>
              <button type="button" onClick={handleClose} className="py-3 text-sm font-semibold text-ink-3">
                {t('common.cancel')}
              </button>
            </div>

            {/* --- En-tête ordinateur --- */}
            <div className="hidden items-start gap-4 lg:flex">
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-[28px] bg-orb text-lg font-extrabold text-white shadow-[0_8px_18px_rgba(75,47,214,0.3)]"
                aria-hidden
              >
                {ini}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <DialogPrimitive.Title className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">
                  {isEditing
                    ? t('clients.form.editTitleNamed', { name: client?.name ?? t('clients.form.editTitleFallback') })
                    : t('clients.form.newTitle')}
                </DialogPrimitive.Title>
                <span className="text-sm text-subtle">
                  {isEditing ? t('clients.form.editHint') : t('clients.form.newHint')}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label={t('common.close')}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-canvas text-ink"
              >
                <X className="size-[18px]" />
              </button>
            </div>
            <DialogPrimitive.Description className="sr-only">
              {t('clients.form.formDescription')}
            </DialogPrimitive.Description>

            {/* --- Avatar centré mobile --- */}
            <div className="flex flex-col items-center gap-2 px-5 pb-1 pt-1.5 lg:hidden">
              <span
                className="flex size-[76px] items-center justify-center rounded-full bg-orb text-2xl font-extrabold text-white shadow-[0_10px_24px_rgba(75,47,214,0.35)]"
                aria-hidden
              >
                {ini}
              </span>
              <span className="text-[13px] text-subtle">
                {isEditing ? t('clients.form.editHintMobile') : t('clients.form.newHintMobile')}
              </span>
            </div>

            <form
              onSubmit={handleSubmit(onSubmitSave)}
              className="flex flex-1 flex-col gap-3.5 px-5 pb-32 pt-2 lg:flex-none lg:px-0 lg:pb-0 lg:pt-5"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="client-name" className="text-[13px] font-semibold text-ink">
                  {t('clients.form.nameLabel')} <span className="text-danger-strong">*</span>
                </label>
                <input
                  id="client-name"
                  placeholder={t('clients.form.namePlaceholder')}
                  {...register('name')}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.name)}
                  className={`h-[50px] rounded-field px-3.5 text-[15px] text-ink disabled:opacity-60 lg:h-[50px] ${inputErrorClass(Boolean(errors.name))}`}
                />
                {errors.name ? (
                  <span className="text-xs font-semibold text-danger-strong">{errors.name.message}</span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="client-phone" className="text-[13px] font-semibold text-ink">
                    {t('clients.phone')}
                  </label>
                  <input
                    id="client-phone"
                    type="tel"
                    placeholder={t('clients.form.phonePlaceholder')}
                    {...register('phone')}
                    disabled={isSubmitting}
                    className="h-12 rounded-field border border-line-strong px-3.5 text-[15px] text-ink disabled:opacity-60 lg:h-12"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="client-email" className="text-[13px] font-semibold text-ink">
                    {t('clients.form.emailLabel')}
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    placeholder={t('clients.form.emailPlaceholder')}
                    {...register('email')}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.email)}
                    className={`h-12 rounded-field px-3.5 text-[15px] text-ink disabled:opacity-60 lg:h-12 ${inputErrorClass(Boolean(errors.email))}`}
                  />
                  {errors.email ? (
                    <span className="text-xs font-semibold text-danger-strong">{errors.email.message}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-semibold text-ink">{t('clients.form.paymentMethodLabel')}</span>
                <FilterChips
                  options={paymentChips.desktop}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  className="hidden lg:flex"
                />
                <FilterChips
                  options={paymentChips.mobile}
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  className="lg:hidden"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="client-billing" className="text-[13px] font-semibold text-ink">
                  {t('clients.billingAddress')}
                </label>
                <textarea
                  id="client-billing"
                  rows={2}
                  placeholder={t('clients.form.billingAddressPlaceholder')}
                  {...register('billing_address')}
                  disabled={isSubmitting}
                  className="rounded-field border border-line-strong px-3.5 py-3 text-[15px] text-ink disabled:opacity-60"
                />
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-tile border border-transparent text-sm font-semibold text-ink-2 lg:border-0 lg:bg-transparent lg:p-0">
                <input
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  disabled={isSubmitting}
                  className="size-5 accent-brand-500"
                />
                {t('clients.form.shippingSameLabel')}
              </label>

              {!sameAsBilling ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="client-shipping" className="text-[13px] font-semibold text-ink">
                    {t('clients.shippingAddress')}
                  </label>
                  <textarea
                    id="client-shipping"
                    rows={2}
                    placeholder={t('clients.form.shippingAddressPlaceholder')}
                    {...register('shipping_address')}
                    disabled={isSubmitting}
                    className="rounded-field border border-line-strong px-3.5 py-3 text-[15px] text-ink disabled:opacity-60"
                  />
                </div>
              ) : null}

              {isEditing ? (
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isSubmitting}
                  className="self-start text-[13px] font-semibold text-danger-strong lg:hidden"
                >
                  {t('clients.form.deleteClient')}
                </button>
              ) : null}

              {/* --- Pied ordinateur --- */}
              <div className="hidden items-center justify-between gap-2.5 border-t border-divider pt-4.5 lg:flex">
                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={isSubmitting}
                    className="text-[13px] font-semibold text-danger-strong"
                  >
                    {t('clients.form.deleteClient')}
                  </button>
                ) : (
                  <span />
                )}
                <span className="flex flex-wrap gap-2.5">
                  <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
                    {t('common.cancel')}
                  </Button>
                  {offerInvoiceAction ? (
                    <Button
                      type="button"
                      variant="black"
                      disabled={isSubmitting}
                      onClick={handleSubmit(onSubmitAndInvoice)}
                    >
                      {t('clients.form.saveAndInvoice')}
                    </Button>
                  ) : null}
                  <Button type="submit" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? t('products.saving') : t('clients.form.save')}
                  </Button>
                </span>
              </div>
            </form>

            {/* --- Barre d'action fixe mobile --- */}
            <div className="glass fixed inset-x-3.5 bottom-[22px] z-10 flex gap-2 rounded-[32px] p-2 lg:hidden">
              {offerInvoiceAction ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit(onSubmitAndInvoice)}
                  className="flex h-[52px] flex-1 items-center justify-center rounded-[26px] bg-surface/85 text-sm font-bold text-ink disabled:opacity-60"
                >
                  {t('clients.form.saveAndInvoiceShort')}
                </button>
              ) : null}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit(onSubmitSave)}
                className="flex h-[52px] flex-[1.4] items-center justify-center rounded-[26px] bg-button text-[15px] font-bold text-white shadow-button disabled:opacity-60"
              >
                {isSubmitting ? t('products.saving') : t('clients.form.saveShort')}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('clients.form.deleteConfirmTitleNamed', { name: client?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {invoicesCount > 0
                ? t('clients.form.deleteConfirmWithInvoices', { count: invoicesCount })
                : t('clients.form.deleteConfirmDefinitive')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('products.detail.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
