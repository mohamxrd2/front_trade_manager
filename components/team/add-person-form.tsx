'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, ChevronLeft, Loader2, X } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { useAuth } from '@/contexts/AuthContext'
import { keys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { addTeamMember, getTeamRoles, type TeamCredentials } from '@/lib/services/team'
import { buildAddTeamMemberPayload } from '@/lib/team/add-member-payload'
import { Button, Card } from '@/components/waelly'
import { RolePicker, type RolePickerValue } from '@/components/team/role-picker'
import { CredentialsScreen } from '@/components/team/credentials-screen'
import { cn } from '@/lib/utils'

function formatShare(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 2 })} %`
}

function buildSchema(t: ReturnType<typeof useTranslation>['t'], language: AppLanguage, maxShare: number) {
  return z
    .object({
      name: z.string().trim().min(1, t('team.validation.nameRequired')).max(255),
      phone: z.string().optional(),
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

const STEP_TITLE_KEYS = ['team.step1Title', 'team.step2Title', 'team.step3Title'] as const

interface AddPersonFormProps {
  /** Part encore disponible pour un nouvel associé (100 % − parts existantes). */
  remainingShare: number
}

/**
 * « Ajouter une personne » en PLEINE PAGE (/team/new), comme la nouvelle
 * vente : en-tête avec fil d'Ariane sur ordinateur, bouton fermer sur
 * mobile. Sur ordinateur, l'étape en cours à gauche et le récapitulatif
 * (étapes + résumé) à droite ; sur mobile, une seule colonne.
 */
function AddPersonForm({ remainingShare }: AddPersonFormProps) {
  const { t, language } = useTranslation()
  const { checkAuth } = useAuth()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: roles } = useQuery({ queryKey: keys.team.roles, queryFn: getTeamRoles })

  const [step, setStep] = React.useState<1 | 2 | 3>(1)
  const [rolePicker, setRolePicker] = React.useState<RolePickerValue>({ role: 'cashier', overrides: [] })
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<{ name: string; credentials: TeamCredentials } | null>(null)

  const schema = React.useMemo(() => buildSchema(t, language, remainingShare), [t, language, remainingShare])
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: '', phone: '', isPartner: false, share: 10, hasAccess: true },
  })

  const isPartner = form.watch('isPartner')
  const hasAccess = form.watch('hasAccess')
  const name = form.watch('name')
  const phone = form.watch('phone')
  const share = form.watch('share')

  const backToTeam = () => router.push('/team')

  const goNext = async () => {
    if (step === 1) {
      if (await form.trigger(['name', 'phone'])) setStep(2)
      return
    }
    if (step === 2) {
      if (!(await form.trigger(['share']))) return
      if (hasAccess && !rolePicker.role) return
      setStep(3)
    }
  }

  const goBack = () => {
    if (step === 1) {
      backToTeam()
      return
    }
    setStep((s) => (s === 3 ? 2 : 1))
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    try {
      const { team_member, credentials } = await addTeamMember(buildAddTeamMemberPayload(data, rolePicker))
      void queryClient.invalidateQueries({ queryKey: keys.team.all })
      void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
      void checkAuth()
      toast.success(t('team.toastAdded', { name: team_member.name }))

      if (credentials) {
        setResult({ name: team_member.name, credentials })
      } else {
        backToTeam()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorAdd'))
    } finally {
      setSubmitting(false)
    }
  })

  const summaryRows: { label: string; value: string }[] = [
    { label: t('team.summary.name'), value: name || '—' },
    ...(phone ? [{ label: t('team.summary.phone'), value: phone }] : []),
    { label: t('team.summary.partner'), value: isPartner ? t('team.summary.yes') : t('team.summary.no') },
    ...(isPartner ? [{ label: t('team.summary.share'), value: formatShare(Number(share) || 0, language) }] : []),
    { label: t('team.summary.access'), value: hasAccess ? t('team.summary.yes') : t('team.summary.no') },
    ...(hasAccess ? [{ label: t('team.summary.role'), value: t(`team.role.${rolePicker.role === 'stock_manager' ? 'stockManager' : rolePicker.role}`) }] : []),
  ]

  const pageTitle = t('team.addSheetTitle')

  const pageHeader = (
    <div className="flex items-center gap-3">
      <div className="flex flex-col gap-1.5">
        <nav aria-label={t('products.breadcrumbAria')} className="hidden gap-2 text-[13px] text-subtle lg:flex">
          <Link href="/team" className="font-semibold">
            {t('team.title')}
          </Link>
          <span aria-hidden>/</span>
          <span>{pageTitle}</span>
        </nav>
        <h1 className="pl-14 text-[22px] font-bold text-ink lg:pl-0 lg:text-[28px] lg:tracking-tight">{pageTitle}</h1>
      </div>
      {/* Fermer (mobile) — même emplacement que sur la nouvelle vente. */}
      <Link
        href="/team"
        aria-label={t('common.close')}
        className="fixed left-4 top-[52px] z-30 flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden"
      >
        <X className="size-5" />
      </Link>
    </div>
  )

  if (result) {
    return (
      <div className="flex flex-col gap-5 pb-28 lg:pb-0">
        {pageHeader}
        <Card className="mx-auto w-full max-w-[560px] rounded-panel">
          <CredentialsScreen name={result.name} credentials={result.credentials} onDone={backToTeam} />
        </Card>
      </div>
    )
  }

  const stepContent = (
    <>
      {step === 1 ? (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="team-add-name" className="text-[13px] font-semibold text-ink">
              {t('team.form.name')}
            </label>
            <input
              id="team-add-name"
              autoFocus
              placeholder={t('team.form.namePlaceholder')}
              className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink"
              {...form.register('name')}
            />
            {form.formState.errors.name ? <p className="text-xs text-danger-strong">{form.formState.errors.name.message}</p> : null}
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
              <input id="team-add-share" inputMode="numeric" className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink" {...form.register('share')} />
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
    </>
  )

  const actions = (
    <div className="flex gap-2.5">
      <Button type="button" variant="secondary" className="h-[52px] flex-1" onClick={goBack}>
        <ChevronLeft className="size-4" strokeWidth={2} />
        {step === 1 ? t('common.cancel') : t('common.previous')}
      </Button>
      {step < 3 ? (
        <Button type="button" variant="primary" className="h-[52px] flex-[2]" onClick={goNext}>
          {t('common.next')}
        </Button>
      ) : (
        <Button type="button" variant="primary" className="h-[52px] flex-[2]" disabled={submitting} onClick={onSubmit}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('team.submitAdd')}
        </Button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      {pageHeader}

      <div className="flex flex-wrap items-start gap-5">
        {/* --- Étape en cours --- */}
        <Card className="flex min-w-0 flex-[3_1_520px] flex-col gap-5 rounded-panel">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{t('team.stepOf', { current: step, total: 3 })}</p>
            <h2 className="text-lg font-bold text-ink">{t(STEP_TITLE_KEYS[step - 1])}</h2>
          </div>
          {stepContent}
          {actions}
        </Card>

        {/* --- Récapitulatif (ordinateur) --- */}
        <Card className="sticky top-5 hidden flex-[2_1_300px] flex-col gap-4 rounded-panel lg:flex">
          <ol className="flex flex-col gap-2.5">
            {STEP_TITLE_KEYS.map((key, i) => {
              const n = i + 1
              const done = n < step
              const current = n === step
              return (
                <li key={key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      done || current ? 'bg-brand-600 text-white' : 'bg-canvas text-subtle'
                    )}
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
                  </span>
                  <span className={cn('text-sm', current ? 'font-bold text-ink' : 'text-subtle')}>{t(key)}</span>
                </li>
              )
            })}
          </ol>
          <dl className="flex flex-col gap-2 border-t border-divider pt-4">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-subtle">{row.label}</dt>
                <dd className="m-0 truncate font-semibold text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  )
}

export { AddPersonForm }
export type { AddPersonFormProps }
