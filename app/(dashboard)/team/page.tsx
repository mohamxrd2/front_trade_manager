'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Check, Copy, Loader2, MoreHorizontal, Plus } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/PermissionGuard'
import { keys } from '@/lib/query-keys'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'
import { getTeam, suspendTeamMember, reactivateTeamMember, removeTeamMember, type TeamMember } from '@/lib/services/team'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber, formatRelative } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { roleLabelKey, roleTone } from '@/lib/permissions/role-labels'
import { Amount } from '@/components/waelly'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ManageMemberPanel } from '@/components/team/manage-member-panel'
import { MemberActivityPanel } from '@/components/team/member-activity-panel'

const AVATAR_CYCLE = [
  { bg: 'bg-brand-100', text: 'text-brand-600' },
  { bg: 'bg-info-bg', text: 'text-info' },
  { bg: 'bg-warning-bg', text: 'text-warning' },
  { bg: 'bg-success-bg', text: 'text-success-strong' },
  { bg: 'bg-danger-bg', text: 'text-danger-strong' },
]
const SHARE_COLORS = ['bg-share-1', 'bg-share-2', 'bg-share-3', 'bg-share-4', 'bg-share-5']

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatShare(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 2 })} %`
}

function formatAmount(n: number, language: AppLanguage): string {
  return `${formatNumber(n, language, { maximumFractionDigits: 0 })} F`
}

type FilterValue = 'all' | 'partners' | 'access' | 'suspended'

function IdentifierRow({ username }: { username: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = React.useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(username)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Best-effort — voir components/team/credentials-screen.tsx.
    }
  }

  return (
    <span className="flex items-center gap-1.5 text-[13px] text-subtle">
      {t('team.identifier')} · <span className="font-semibold text-ink">{username}</span>
      <button type="button" onClick={copy} aria-label={t('team.copyIdentifierAria')} className="flex size-6 items-center justify-center rounded-full text-ink-3">
        {copied ? <Check className="size-3.5" strokeWidth={2.2} /> : <Copy className="size-3.5" strokeWidth={2} />}
      </button>
    </span>
  )
}

export default function TeamPage() {
  return (
    <PermissionGuard permission="team.manage">
      <TeamPageContent />
    </PermissionGuard>
  )
}

function TeamPageContent() {
  const { user } = useAuth()
  const { t, language } = useTranslation()
  const queryClient = useQueryClient()

  const { base, isNegativeBase, isLoading: sharesLoading, collaborators, ownerShare, remainingShare } = useCollaboratorShares()

  const { data: team, isLoading: teamLoading, error: teamError } = useQuery({ queryKey: keys.team.all, queryFn: getTeam })

  const [filter, setFilter] = React.useState<FilterValue>('all')
  const [manageTarget, setManageTarget] = React.useState<TeamMember | null>(null)
  const [activityTarget, setActivityTarget] = React.useState<TeamMember | null>(null)
  const [suspendTarget, setSuspendTarget] = React.useState<TeamMember | null>(null)
  const [reactivateTarget, setReactivateTarget] = React.useState<TeamMember | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<TeamMember | null>(null)
  const [actionPending, setActionPending] = React.useState(false)

  React.useEffect(() => {
    if (teamError) toast.error(teamError instanceof Error ? teamError.message : t('team.errorLoad'))
  }, [teamError, t])

  const members = team ?? []
  const withAccessCount = members.filter((m) => m.access === 'active').length

  const filteredMembers = members.filter((m) => {
    if (filter === 'partners') return m.is_partner
    if (filter === 'access') return m.access === 'active'
    if (filter === 'suspended') return m.access === 'suspended'
    return true
  })

  const shareMembers = [
    { id: 'owner', name: user ? `${user.first_name} ${user.last_name}`.trim() : '', share: ownerShare.share },
    ...(collaborators ?? []).map((c) => ({ id: c.id, name: c.name, share: Number(c.part) })),
  ]
  const shareAria = shareMembers.map((m) => `${m.name} ${formatShare(m.share, language)}`).join(', ')
  const isEmpty = !teamLoading && members.length === 0

  const invalidateTeam = () => {
    void queryClient.invalidateQueries({ queryKey: keys.team.all })
    void queryClient.invalidateQueries({ queryKey: keys.collaborators.all })
  }

  const confirmSuspend = async () => {
    if (!suspendTarget) return
    setActionPending(true)
    try {
      await suspendTeamMember(suspendTarget.id)
      invalidateTeam()
      toast.success(t('team.toastSuspended', { name: suspendTarget.name }))
      setSuspendTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorSuspend'))
    } finally {
      setActionPending(false)
    }
  }

  const confirmReactivate = async () => {
    if (!reactivateTarget) return
    setActionPending(true)
    try {
      await reactivateTeamMember(reactivateTarget.id)
      invalidateTeam()
      toast.success(t('team.toastReactivated', { name: reactivateTarget.name }))
      setReactivateTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorReactivate'))
    } finally {
      setActionPending(false)
    }
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setActionPending(true)
    try {
      await removeTeamMember(removeTarget.id)
      invalidateTeam()
      toast.success(t('team.toastRemoved', { name: removeTarget.name }))
      setRemoveTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorRemove'))
    } finally {
      setActionPending(false)
    }
  }

  const ShareBar = ({ compact }: { compact: boolean }) => (
    <section
      className="flex flex-col text-white shadow-[0_14px_30px_rgba(16,16,120,0.24)]"
      style={{
        borderRadius: compact ? 24 : 26,
        padding: compact ? 18 : 22,
        gap: compact ? 12 : 14,
        background: `radial-gradient(${compact ? '120% 120%' : '120% 140%'} at 100% 100%, #3A3AF0 0%, #1717A0 40%, #0A0A4A 85%)`,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className={`font-bold ${compact ? 'text-base' : 'text-[17px]'}`}>{t('collaborators.shareDistribution')}</span>
          <span className="text-xs" style={{ color: '#C8C8F0' }}>
            {t('collaborators.shareDistributionBase', { amount: formatAmount(base, language) })}
          </span>
        </span>
        <span className="text-[13px]" style={{ color: '#C8C8F0' }}>
          {t('collaborators.teamSize', { count: shareMembers.length })}
        </span>
      </div>
      {sharesLoading ? (
        <div className="h-3.5 animate-pulse rounded-full bg-white/15" />
      ) : (
        <div role="img" aria-label={shareAria} className="flex overflow-hidden" style={{ height: compact ? 12 : 14, borderRadius: compact ? 6 : 7, gap: 3 }}>
          {shareMembers.map((m, i) => (
            <span key={m.id} className={`block h-full ${SHARE_COLORS[i % 5]}`} style={{ flex: `${Math.max(m.share, 0.01)} 1 0` }} />
          ))}
        </div>
      )}
      <div className={`flex flex-wrap ${compact ? 'gap-2 text-xs' : 'gap-4 text-[13px]'}`} style={{ color: '#DCDCF7' }}>
        {shareMembers.map((m, i) => (
          <span key={m.id} className="flex items-center gap-1.5">
            <span className={`rounded-full ${SHARE_COLORS[i % 5]}`} style={{ width: compact ? 8 : 10, height: compact ? 8 : 10 }} />
            {m.name.split(' ')[0]} · {formatShare(m.share, language)}
          </span>
        ))}
      </div>
    </section>
  )

  const MemberCard = ({ member, index }: { member: TeamMember; index: number }) => {
    const cycle = AVATAR_CYCLE[index % AVATAR_CYCLE.length]
    const tone = roleTone(member.role)

    return (
      <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5">
        <div className="flex items-start gap-3">
          {member.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${cycle.bg} ${cycle.text}`}>
              {getInitials(member.name)}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-[15px] font-bold text-ink">{member.name}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {member.is_owner ? (
                <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-bold text-brand-700">{t('team.badgeOwner')}</span>
              ) : null}
              {member.role ? (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.bg} ${tone.text}`}>{t(roleLabelKey(member.role))}</span>
              ) : null}
              {member.is_partner ? (
                <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-bold text-ink-2">
                  {t('team.badgePartner', { share: formatShare(Number(member.part ?? 0), language) })}
                </span>
              ) : null}
              {member.access === 'suspended' ? (
                <span className="rounded-full bg-danger-bg px-2.5 py-1 text-[11px] font-bold text-danger-strong">{t('team.badgeSuspended')}</span>
              ) : null}
            </div>
            {member.username ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <IdentifierRow username={member.username} />
                {member.last_login_at ? (
                  <span className="text-[13px] text-subtle">{t('team.lastLogin', { time: formatRelative(member.last_login_at, language) })}</span>
                ) : null}
              </div>
            ) : null}
            {member.last_30_days ? (
              <span className="flex flex-wrap items-center gap-1 text-[13px] text-subtle">
                <span>{t('team.salesCount', { count: member.last_30_days.sales_count })} ·</span>
                <Amount value={member.last_30_days.total} currency />
                <span>{t('team.salesPeriodLabel')}</span>
              </span>
            ) : null}
            {member.is_partner && member.part_amount !== null ? (
              <span className="text-[13px] font-semibold text-success">
                <Amount value={member.part_amount ?? 0} currency />
              </span>
            ) : null}
          </div>

          {member.is_owner ? (
            <Link href="/settings" className="flex h-9 shrink-0 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-ink">
              {t('team.actions.modify')}
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('team.actionsMenuAria', { name: member.name })}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2"
                >
                  <MoreHorizontal className="size-4" strokeWidth={2} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setManageTarget(member)}>{t('team.actions.modify')}</DropdownMenuItem>
                {member.username ? (
                  <DropdownMenuItem onSelect={() => setManageTarget(member)}>{t('team.actions.credentials')}</DropdownMenuItem>
                ) : null}
                {member.access === 'active' ? (
                  <DropdownMenuItem onSelect={() => setSuspendTarget(member)}>{t('team.actions.suspend')}</DropdownMenuItem>
                ) : null}
                {member.access === 'suspended' ? (
                  <DropdownMenuItem onSelect={() => setReactivateTarget(member)}>{t('team.actions.reactivate')}</DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => setActivityTarget(member)}>{t('team.actions.activity')}</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoveTarget(member)}>
                  {t('team.actions.remove')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    )
  }

  const FILTERS: { value: FilterValue; labelKey: string }[] = [
    { value: 'all', labelKey: 'team.filter.all' },
    { value: 'partners', labelKey: 'team.filter.partners' },
    { value: 'access', labelKey: 'team.filter.access' },
    { value: 'suspended', labelKey: 'team.filter.suspended' },
  ]

  const remainingShareForEdit = manageTarget ? remainingShare + Number(manageTarget.part ?? 0) : remainingShare

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 1024px / lg) ============================= */}
      <div className="hidden flex-col gap-5 lg:flex">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[28px] font-bold tracking-tight text-ink">{t('team.title')}</h1>
            <span className="text-sm text-subtle">
              {t('team.subtitlePeople', { count: members.length })} · {t('team.subtitleAccess', { count: withAccessCount })}
            </span>
          </div>
          <Link
            href="/team/new"
            className="flex h-11 items-center gap-2 rounded-full bg-button px-4.5 text-sm font-bold text-white shadow-button"
          >
            <Plus className="size-[18px]" strokeWidth={2.2} />
            {t('team.add')}
          </Link>
        </div>

        {sharesLoading ? <div className="h-[140px] animate-pulse rounded-panel bg-surface-soft" /> : <ShareBar compact={false} />}
        {!sharesLoading && isNegativeBase ? (
          <p className="text-sm font-semibold" style={{ color: '#A3213A' }}>
            {t('collaborators.negativeResultPeriod', { amount: formatAmount(base, language) })}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                filter === f.value ? 'bg-active text-white' : 'border border-line-strong bg-surface text-ink-2'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {teamLoading ? (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}>
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-[20px] bg-surface-soft" />)}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-1 rounded-panel border border-dashed border-line-strong py-12 text-center">
            <span className="text-base font-bold text-ink">{t('team.emptyTitle')}</span>
            <span className="text-sm text-subtle">{t('team.emptyDescription')}</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <p className="py-8 text-center text-sm text-subtle">{t('team.noResultsForFilter')}</p>
        ) : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}>
            {filteredMembers.map((m, i) => <MemberCard key={m.id} member={m} index={i} />)}
          </div>
        )}
      </div>

      {/* ============================= MOBILE (< 1024px / lg) ============================= */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div className="flex items-center gap-3">
          <Link href="/settings" aria-label={t('team.backToSettingsAria')} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink">
            <ChevronLeft className="size-[22px]" strokeWidth={2} />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h1 className="truncate text-[22px] font-bold tracking-tight text-ink">{t('team.title')}</h1>
            <span className="truncate text-xs text-subtle">
              {t('team.subtitlePeople', { count: members.length })} · {t('team.subtitleAccess', { count: withAccessCount })}
            </span>
          </div>
          <Link
            href="/team/new"
            aria-label={t('team.addAria')}
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_18px_rgba(75,47,214,0.35)]"
            style={{ background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)' }}
          >
            <Plus className="size-[22px]" strokeWidth={2.2} />
          </Link>
        </div>

        {sharesLoading ? <div className="h-[120px] animate-pulse rounded-[24px] bg-surface-soft" /> : <ShareBar compact />}
        {!sharesLoading && isNegativeBase ? (
          <p className="text-sm font-semibold" style={{ color: '#A3213A' }}>
            {t('collaborators.negativeResultPeriod', { amount: formatAmount(base, language) })}
          </p>
        ) : null}

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                filter === f.value ? 'bg-active text-white' : 'border border-line-strong bg-surface text-ink-2'
              }`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        {teamLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-[20px] bg-surface-soft" />)
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-1 rounded-[20px] border border-dashed border-line-strong py-10 text-center">
            <span className="text-base font-bold text-ink">{t('team.emptyTitle')}</span>
            <span className="text-sm text-subtle">{t('team.emptyDescription')}</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <p className="py-8 text-center text-sm text-subtle">{t('team.noResultsForFilter')}</p>
        ) : (
          filteredMembers.map((m, i) => <MemberCard key={m.id} member={m} index={i} />)
        )}
      </div>

      <ManageMemberPanel member={manageTarget} onOpenChange={(open) => !open && setManageTarget(null)} remainingShareForEdit={remainingShareForEdit} />
      <MemberActivityPanel member={activityTarget} onOpenChange={(open) => !open && setActivityTarget(null)} />

      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.suspendConfirmTitle', { name: suspendTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.suspendConfirmDescription', { name: suspendTarget?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSuspend} disabled={actionPending}>
              {actionPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('team.actions.suspend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reactivateTarget} onOpenChange={(open) => !open && setReactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.reactivateConfirmTitle', { name: reactivateTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.reactivateConfirmDescription', { name: reactivateTarget?.name ?? '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReactivate} disabled={actionPending}>
              {actionPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('team.actions.reactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.removeConfirmTitle', { name: removeTarget?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('team.removeConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={actionPending}>
              {actionPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('team.actions.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
