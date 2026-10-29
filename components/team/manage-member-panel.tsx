'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, X } from 'lucide-react'

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
import { Button } from '@/components/waelly'
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RolePicker, type RolePickerValue } from '@/components/team/role-picker'
import { CredentialsScreen } from '@/components/team/credentials-screen'
import type { AssignableRole } from '@/lib/permissions/catalog'
import { useIsDesktop } from '@/hooks/useIsDesktop'

function formatShare(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 2 })} %`
}

function buildSchema(t: ReturnType<typeof useTranslation>['t'], language: AppLanguage, maxShare: number, isPartner: boolean) {
  return z
    .object({
      name: z.string().min(1, t('team.validation.nameRequired')).max(255),
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

interface ManageMemberPanelProps {
  member: TeamMember | null
  onOpenChange: (open: boolean) => void
  /** Part disponible POUR CE formulaire : exclut déjà la part actuelle de ce membre (voir même logique que app/(dashboard)/collaborators/page.tsx). */
  remainingShareForEdit: number
}

function ManageMemberPanel({ member, onOpenChange, remainingShareForEdit }: ManageMemberPanelProps) {
  const { t, language } = useTranslation()
  const queryClient = useQueryClient()
  const isDesktop = useIsDesktop()
  const open = member !== null
  const hasAccess = !!member?.username

  const { data: roles } = useQuery({ queryKey: keys.team.roles, queryFn: getTeamRoles, enabled: open })

  const [rolePicker, setRolePicker] = React.useState<RolePickerValue>({ role: 'cashier', overrides: [] })
  const [pendingRole, setPendingRole] = React.useState<RolePickerValue | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [resetting, setResetting] = React.useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = React.useState(false)
  const [resetResult, setResetResult] = React.useState<TeamCredentials | null>(null)

  const schema = React.useMemo(() => buildSchema(t, language, remainingShareForEdit, member?.is_partner ?? false), [t, language, remainingShareForEdit, member?.is_partner])
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: '', phone: '', email: '', share: undefined },
  })

  React.useEffect(() => {
    if (!member) return
    form.reset({
      name: member.name,
      phone: member.phone ?? '',
      email: member.email ?? '',
      share: member.part ?? undefined,
    })
    setRolePicker({ role: (member.role as AssignableRole) ?? 'cashier', overrides: [] })
    setPendingRole(null)
    setResetResult(null)
  }, [member, form])

  const close = () => onOpenChange(false)

  const handleRoleChange = (next: RolePickerValue) => {
    if (next.role !== rolePicker.role) {
      setPendingRole(next)
      return
    }
    setRolePicker(next)
  }

  const confirmRoleChange = () => {
    if (pendingRole) setRolePicker(pendingRole)
    setPendingRole(null)
  }

  const onSubmit = form.handleSubmit(async (data) => {
    if (!member) return
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
      close()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorUpdate'))
    } finally {
      setSubmitting(false)
    }
  })

  const confirmResetCode = async () => {
    if (!member) return
    setResetting(true)
    try {
      const { login_code } = await resetTeamMemberCode(member.id)
      setResetResult({
        username: member.username ?? '',
        code: login_code,
        login_url: `${window.location.origin}/login`,
      })
      toast.success(t('team.toastCodeReset'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorCodeReset'))
    } finally {
      setResetting(false)
      setResetConfirmOpen(false)
    }
  }

  const body = member && resetResult ? (
    <CredentialsScreen name={member.name} credentials={resetResult} onDone={close} />
  ) : (
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

      {member?.is_partner ? (
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

      <Button type="submit" variant="primary" className="h-[52px] w-full" disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {t('products.save')}
      </Button>

      {hasAccess ? (
        <button
          type="button"
          onClick={() => setResetConfirmOpen(true)}
          className="flex h-11 items-center justify-center rounded-full border border-line-strong text-sm font-semibold text-ink"
        >
          {t('team.actions.credentials')}
        </button>
      ) : null}
    </form>
  )

  // SheetContent a déjà son propre bouton de fermeture (coin haut-droit) —
  // ne pas en remettre un ici sur ordinateur (deux "X" sinon) ; DrawerContent
  // (mobile) n'en fournit aucun, on garde le nôtre.
  const header = (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-base font-bold text-ink">{member ? t('team.manageSheetTitle', { name: member.name }) : ''}</span>
      {isDesktop ? null : (
        <button type="button" onClick={close} aria-label={t('common.close')} className="flex size-9 items-center justify-center rounded-full bg-canvas text-ink">
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )

  const panel = isDesktop ? (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-[420px]">
        <SheetHeader className="border-b border-line pb-3.5">
          <SheetTitle className="sr-only">{member ? t('team.manageSheetTitle', { name: member.name }) : ''}</SheetTitle>
          {header}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">{body}</div>
      </SheetContent>
    </Sheet>
  ) : (
    <Drawer open={open} onOpenChange={(next) => !next && close()}>
      <DrawerContent className="max-h-[94vh] px-5 pb-8 pt-2.5">
        <DrawerHeader className="mt-1.5 p-0">
          <DrawerTitle className="sr-only">{member ? t('team.manageSheetTitle', { name: member.name }) : ''}</DrawerTitle>
          {header}
        </DrawerHeader>
        <div className="mt-4 overflow-y-auto">{body}</div>
      </DrawerContent>
    </Drawer>
  )

  return (
    <>
      {panel}

      <AlertDialog open={!!pendingRole} onOpenChange={(next) => !next && setPendingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.roleChangeConfirmTitle', { name: member?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.roleChangeConfirmDescription', { name: member?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.resetCodeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.resetCodeConfirmDescription', { name: member?.name ?? '' })}</AlertDialogDescription>
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
    </>
  )
}

export { ManageMemberPanel }
export type { ManageMemberPanelProps }
