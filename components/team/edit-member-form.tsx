'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, Loader2, X } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { keys } from '@/lib/query-keys'
import { formatNumber } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import {
  getTeamRoles,
  resetTeamMemberCode,
  updateTeamMember,
  type PermissionOverride,
  type TeamCredentials,
  type TeamMember,
} from '@/lib/services/team'
import { Amount, Button, Card } from '@/components/waelly'
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
import { RolePicker, type RolePickerValue } from '@/components/team/role-picker'
import { CredentialsScreen } from '@/components/team/credentials-screen'
import type { AssignableRole } from '@/lib/permissions/catalog'
import { roleLabelKey, roleTone } from '@/lib/permissions/role-labels'

function formatShare(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 2 })} %`
}

function buildSchema(t: ReturnType<typeof useTranslation>['t'], language: AppLanguage, maxShare: number, isPartner: boolean) {
  return z
    .object({
      name: z.string().trim().min(1, t('team.validation.nameRequired')).max(255),
      phone: z.string().optional(),
      email: z
        .string()
        .optional()
        .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), t('team.validation.emailInvalid')),
      share: z.coerce.number().optional(),
    })
    .superRefine((data, ctx) => {
      if (!isPartner) return
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

interface EditMemberFormProps {
  member: TeamMember
  /** Part disponible pour CE membre : 100 % − les parts des AUTRES associés. */
  remainingShareForEdit: number
}

/**
 * « Modifier » un membre en PLEINE PAGE (/team/[id]/edit), comme l'ajout :
 * coordonnées, part (associé), rôle et permissions (accès), et à droite le
 * récapitulatif avec « Générer un nouveau code ». Un changement de rôle
 * demande confirmation (le membre est déconnecté).
 */
function EditMemberForm({ member, remainingShareForEdit }: EditMemberFormProps) {
  const { t, language } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasAccess = !!member.username
  const { data: roles } = useQuery({ queryKey: keys.team.roles, queryFn: getTeamRoles, enabled: hasAccess })

  const [rolePicker, setRolePicker] = React.useState<RolePickerValue>({ role: (member.role as AssignableRole) ?? 'cashier', overrides: [] })
  const [pendingRole, setPendingRole] = React.useState<RolePickerValue | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false)
  const [resetResult, setResetResult] = React.useState<TeamCredentials | null>(null)

  const schema = React.useMemo(
    () => buildSchema(t, language, remainingShareForEdit, member.is_partner),
    [t, language, remainingShareForEdit, member.is_partner]
  )
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: member.name, phone: member.phone ?? '', email: member.email ?? '', share: member.part ?? undefined },
  })

  const backToTeam = () => router.push('/team')

  const handleRoleChange = (next: RolePickerValue) => {
    if (next.role !== rolePicker.role) {
      setPendingRole(next)
      return
    }
    setRolePicker(next)
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setSubmitting(true)
    try {
      const overrides: PermissionOverride[] | undefined = hasAccess && rolePicker.overrides.length > 0 ? rolePicker.overrides : undefined
      await updateTeamMember(member.id, {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        share: member.is_partner ? Number(data.share) : undefined,
        role: hasAccess ? rolePicker.role : undefined,
        permissions_overrides: overrides,
      })
      void queryClient.invalidateQueries({ queryKey: keys.team.all })
      void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
      toast.success(t('team.toastUpdated'))
      backToTeam()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorUpdate'))
    } finally {
      setSubmitting(false)
    }
  })

  const confirmResetCode = async () => {
    setResetting(true)
    try {
      const { login_code } = await resetTeamMemberCode(member.id)
      setResetResult({ username: member.username ?? '', code: login_code, login_url: `${window.location.origin}/login` })
      toast.success(t('team.toastCodeReset'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorCodeReset'))
    } finally {
      setResetting(false)
      setResetConfirmOpen(false)
    }
  }

  const pageTitle = t('team.manageSheetTitle', { name: member.name })
  const tone = roleTone(member.role)

  const pageHeader = (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <nav aria-label={t('products.breadcrumbAria')} className="hidden gap-2 text-[13px] text-subtle lg:flex">
          <Link href="/team" className="font-semibold">
            {t('team.title')}
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate">{member.name}</span>
        </nav>
        <h1 className="truncate pl-14 text-[22px] font-bold text-ink lg:pl-0 lg:text-[28px] lg:tracking-tight">{pageTitle}</h1>
      </div>
      <Link
        href="/team"
        aria-label={t('common.close')}
        className="fixed left-4 top-[52px] z-30 flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden"
      >
        <X className="size-5" />
      </Link>
    </div>
  )

  if (resetResult) {
    return (
      <div className="flex flex-col gap-5 pb-28 lg:pb-0">
        {pageHeader}
        <Card className="mx-auto w-full max-w-[560px] rounded-panel">
          <CredentialsScreen name={member.name} credentials={resetResult} onDone={backToTeam} />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 pb-28 lg:pb-0">
      {pageHeader}

      <div className="flex flex-wrap items-start gap-5">
        {/* --- Formulaire --- */}
        <Card className="flex min-w-0 flex-[3_1_520px] flex-col gap-4 rounded-panel">
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-edit-name" className="text-[13px] font-semibold text-ink">
                {t('team.form.name')}
              </label>
              <input id="team-edit-name" className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink" {...form.register('name')} />
              {form.formState.errors.name ? <p className="text-xs text-danger-strong">{form.formState.errors.name.message}</p> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-edit-phone" className="text-[13px] font-semibold text-ink">
                {t('team.form.phone')}
              </label>
              <input id="team-edit-phone" type="tel" className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink" {...form.register('phone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-edit-email" className="text-[13px] font-semibold text-ink">
                {t('team.form.email')}
              </label>
              <input id="team-edit-email" type="email" className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink" {...form.register('email')} />
              {form.formState.errors.email ? <p className="text-xs text-danger-strong">{form.formState.errors.email.message}</p> : null}
            </div>

            {member.is_partner ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="team-edit-share" className="text-[13px] font-semibold text-ink">
                  {t('team.shareLabel')}
                </label>
                <input id="team-edit-share" inputMode="numeric" className="h-12 rounded-field border border-line-strong px-3.5 text-sm text-ink" {...form.register('share')} />
                {form.formState.errors.share ? (
                  <p className="text-xs text-danger-strong">{form.formState.errors.share.message}</p>
                ) : (
                  <p className="text-xs text-subtle">{t('team.shareRemaining', { share: formatShare(Math.max(0, remainingShareForEdit), language) })}</p>
                )}
              </div>
            ) : null}

            {hasAccess ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-ink">{t('team.chooseRole')}</span>
                <RolePicker roles={roles ?? []} value={rolePicker} onChange={handleRoleChange} />
              </div>
            ) : null}

            <div className="flex gap-2.5 pt-1">
              <Button type="button" variant="secondary" className="h-[52px] flex-1" onClick={backToTeam}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" className="h-[52px] flex-[2]" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {t('products.save')}
              </Button>
            </div>
          </form>
        </Card>

        {/* --- Récapitulatif + identifiants --- */}
        <Card className="flex flex-[2_1_300px] flex-col gap-4 rounded-panel lg:sticky lg:top-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {member.role ? (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.bg} ${tone.text}`}>{t(roleLabelKey(member.role))}</span>
            ) : null}
            {member.is_partner ? (
              <span className="rounded-full bg-success-bg px-2.5 py-1 text-[11px] font-bold text-success-strong">
                {t('team.badgePartner', { share: formatShare(Number(member.part ?? 0), language) })}
              </span>
            ) : null}
            {member.access === 'suspended' ? (
              <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-bold text-danger-strong">{t('team.badgeSuspended')}</span>
            ) : null}
          </div>

          {member.last_30_days ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{t('team.stats.sales30d')}</span>
              <span className="text-[22px] font-extrabold text-brand-600">
                <Amount value={member.last_30_days.total} currency />
              </span>
              <span className="text-xs text-subtle">{t('team.salesCount', { count: member.last_30_days.sales_count })}</span>
            </div>
          ) : null}
          {member.is_partner && member.part_amount !== null ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{t('team.stats.shareAmount')}</span>
              <span className="text-[22px] font-extrabold text-success">
                <Amount value={member.part_amount ?? 0} currency />
              </span>
            </div>
          ) : null}

          {hasAccess ? (
            <div className="flex flex-col gap-2 border-t border-divider pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{t('team.identifier')}</span>
              <span className="font-mono text-sm font-bold text-ink">{member.username}</span>
              <Button type="button" variant="secondary" onClick={() => setResetConfirmOpen(true)}>
                <KeyRound className="size-4" />
                {t('team.actions.credentials')}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>

      <AlertDialog open={!!pendingRole} onOpenChange={(next) => !next && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.roleChangeConfirmTitle', { name: member.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.roleChangeConfirmDescription', { name: member.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRole) setRolePicker(pendingRole)
                setPendingRole(null)
              }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.resetCodeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.resetCodeConfirmDescription', { name: member.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetCode} disabled={resetting}>
              {resetting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export { EditMemberForm }
export type { EditMemberFormProps }
