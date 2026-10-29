'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Loader2, X } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useAuth } from '@/contexts/AuthContext'
import { keys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { addTeamMember, getTeamRoles, type TeamCredentials } from '@/lib/services/team'
import { Button } from '@/components/waelly'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RolePicker, type RolePickerValue } from '@/components/team/role-picker'
import { CredentialsScreen } from '@/components/team/credentials-screen'
import { useIsDesktop } from '@/hooks/useIsDesktop'

function formatShare(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 2 })} %`
}

function buildSchema(t: ReturnType<typeof useTranslation>['t'], language: AppLanguage, maxShare: number) {
  return z
    .object({
      name: z.string().min(1, t('team.validation.nameRequired')).max(255),
      phone: z.string().optional(),
      email: z
        .string()
        .optional()
        .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), t('team.validation.emailInvalid')),
      isPartner: z.boolean(),
      share: z.coerce.number().optional(),
      hasAccess: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (!data.isPartner) return
      const cap = Math.max(0.01, Math.min(99.99, maxShare))
      if (data.share === undefined || Number.isNaN(data.share)) {
        ctx.addIssue({ code: 'custom', path: ['share'], message: t('team.validation.shareRequired') })
      } else if (data.share < 0.01) {
        ctx.addIssue({ code: 'custom', path: ['share'], message: t('team.validation.shareMin') })
      } else if (data.share > cap) {
        ctx.addIssue({ code: 'custom', path: ['share'], message: t('team.validation.shareExceeds', { share: formatShare(maxShare, language) }) })
      }
    })
}

type FormInput = z.input<ReturnType<typeof buildSchema>>
type FormOutput = z.output<ReturnType<typeof buildSchema>>

interface AddPersonPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  remainingShare: number
}

function AddPersonPanel({ open, onOpenChange, remainingShare }: AddPersonPanelProps) {
  const { t, language } = useTranslation()
  const { checkAuth } = useAuth()
  const queryClient = useQueryClient()
  const isDesktop = useIsDesktop()
  const { data: roles } = useQuery({ queryKey: keys.team.roles, queryFn: getTeamRoles, enabled: open })

  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [rolePicker, setRolePicker] = React.useState<RolePickerValue>({ role: 'cashier', overrides: [] })
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<{ name: string; credentials: TeamCredentials } | null>(null)

  const schema = React.useMemo(() => buildSchema(t, language, remainingShare), [t, language, remainingShare])
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: '', phone: '', email: '', isPartner: false, share: 10, hasAccess: true },
  })

  const reset = React.useCallback(() => {
    setStep(1)
    setResult(null)
    setRolePicker({ role: 'cashier', overrides: [] })
    form.reset({ name: '', phone: '', email: '', isPartner: false, share: 10, hasAccess: true })
  }, [form])

  const close = () => {
    onOpenChange(false)
    reset()
  }

  const isPartner = form.watch('isPartner')
  const hasAccess = form.watch('hasAccess')

  const goNext = async () => {
    if (step === 1) {
      const valid = await form.trigger(['name', 'phone', 'email'])
      if (valid) setStep(2)
      return
    }
    if (step === 2) {
      const valid = await form.trigger(['share'])
      if (!valid) return
      if (hasAccess && !rolePicker.role) return
      setStep(3)
    }
  }

  const goBack = () => {
    if (step === 1) {
      close()
      return
    }
    setStep((s) => (s === 3 ? 2 : 1) as 1 | 2)
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    try {
      const { team_member, credentials } = await addTeamMember({
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        photo: null,
        is_partner: data.isPartner,
        share: data.isPartner ? Number(data.share) : undefined,
        has_access: data.hasAccess,
        role: data.hasAccess ? rolePicker.role : undefined,
        permissions_overrides: data.hasAccess && rolePicker.overrides.length > 0 ? rolePicker.overrides : undefined,
      })
      void queryClient.invalidateQueries({ queryKey: keys.team.all })
      void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
      void checkAuth()
      toast.success(t('team.toastAdded', { name: team_member.name }))

      if (credentials) {
        setResult({ name: team_member.name, credentials })
      } else {
        close()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorAdd'))
    } finally {
      setSubmitting(false)
    }
  })

  const summaryRows: { label: string; value: string }[] = [
    { label: t('team.summary.name'), value: form.watch('name') },
    ...(form.watch('phone') ? [{ label: t('team.summary.phone'), value: form.watch('phone') as string }] : []),
    ...(form.watch('email') ? [{ label: t('team.summary.email'), value: form.watch('email') as string }] : []),
    { label: t('team.summary.partner'), value: isPartner ? t('team.summary.yes') : t('team.summary.no') },
    ...(isPartner ? [{ label: t('team.summary.share'), value: formatShare(Number(form.watch('share')) || 0, language) }] : []),
    { label: t('team.summary.access'), value: hasAccess ? t('team.summary.yes') : t('team.summary.no') },
    ...(hasAccess ? [{ label: t('team.summary.role'), value: t(`team.role.${rolePicker.role === 'stock_manager' ? 'stockManager' : rolePicker.role}`) }] : []),
  ]

  const body = result ? (
    <CredentialsScreen name={result.name} credentials={result.credentials} onDone={close} />
  ) : (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t('team.stepOf', { current: step, total: 3 })}</p>

      {step === 1 ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-add-name" className="text-[13px] font-semibold text-ink">
              {t('team.form.name')}
            </label>
            <input
              id="team-add-name"
              placeholder={t('team.form.namePlaceholder')}
              className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink"
              {...form.register('name')}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-danger-strong">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-add-phone" className="text-[13px] font-semibold text-ink">
              {t('team.form.phone')}
            </label>
            <input
              id="team-add-phone"
              type="tel"
              placeholder={t('team.form.phonePlaceholder')}
              className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink"
              {...form.register('phone')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-add-email" className="text-[13px] font-semibold text-ink">
              {t('team.form.email')}
            </label>
            <input
              id="team-add-email"
              type="email"
              placeholder={t('team.form.emailPlaceholder')}
              className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-danger-strong">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface p-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-ink">{t('team.isPartnerToggle')}</span>
              <span className="text-xs text-subtle">{t('team.isPartnerHint')}</span>
            </span>
            <input
              type="checkbox"
              checked={isPartner}
              onChange={(e) => form.setValue('isPartner', e.target.checked, { shouldValidate: true })}
              className="size-5 shrink-0 accent-brand-600"
            />
          </label>
          {isPartner ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-add-share" className="text-[13px] font-semibold text-ink">
                {t('team.shareLabel')}
              </label>
              <input
                id="team-add-share"
                inputMode="numeric"
                className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink"
                {...form.register('share')}
              />
              {form.formState.errors.share ? (
                <p className="text-xs text-danger-strong">{form.formState.errors.share.message}</p>
              ) : (
                <p className="text-xs text-subtle">{t('team.shareRemaining', { share: formatShare(Math.max(0, remainingShare), language) })}</p>
              )}
            </div>
          ) : null}

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface p-3.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-ink">{t('team.hasAccessToggle')}</span>
              <span className="text-xs text-subtle">{t('team.hasAccessHint')}</span>
            </span>
            <input
              type="checkbox"
              checked={hasAccess}
              onChange={(e) => form.setValue('hasAccess', e.target.checked, { shouldValidate: true })}
              className="size-5 shrink-0 accent-brand-600"
            />
          </label>
          {hasAccess ? (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink">{t('team.chooseRole')}</span>
              <RolePicker roles={roles ?? []} value={rolePicker} onChange={setRolePicker} />
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-ink">{t('team.summary.title')}</h3>
          <dl className="flex flex-col gap-2 rounded-2xl border border-line-strong bg-surface p-3.5">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-subtle">{row.label}</dt>
                <dd className="m-0 font-semibold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex gap-2.5">
        {step < 3 ? (
          <Button type="button" variant="primary" className="h-[52px] w-full" onClick={goNext}>
            {t('common.next')}
          </Button>
        ) : (
          <Button type="button" variant="primary" className="h-[52px] w-full" disabled={submitting} onClick={onSubmit}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('team.submitAdd')}
          </Button>
        )}
      </div>
    </div>
  )

  // SheetContent a déjà son propre bouton de fermeture (coin haut-droit,
  // Radix) — ne pas en remettre un ici sur ordinateur (deux "X" sinon).
  // DrawerContent (mobile), lui, n'en fournit aucun : on garde le nôtre.
  const header = (
    <div className="flex items-center gap-3">
      <button type="button" onClick={goBack} aria-label={t('common.previous')} className="flex size-9 items-center justify-center rounded-full bg-canvas text-ink">
        <ChevronLeft className="size-[18px]" strokeWidth={2} />
      </button>
      <span className="flex-1 text-base font-bold text-ink">
        {result ? '' : step === 1 ? t('team.step1Title') : step === 2 ? t('team.step2Title') : t('team.step3Title')}
      </span>
      {isDesktop ? null : (
        <button type="button" onClick={close} aria-label={t('common.close')} className="flex size-9 items-center justify-center rounded-full bg-canvas text-ink">
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && close()}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-[420px]">
          <SheetHeader className="border-b border-line pb-3.5">
            <SheetTitle className="sr-only">{t('team.addSheetTitle')}</SheetTitle>
            {header}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-6">{body}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-h-[94vh] px-5 pb-8 pt-2.5">
        <DrawerHeader className="mt-1.5 p-0">
          <DrawerTitle className="sr-only">{t('team.addSheetTitle')}</DrawerTitle>
          {header}
        </DrawerHeader>
        <div className="mt-4 overflow-y-auto">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}

export { AddPersonPanel }
export type { AddPersonPanelProps }
