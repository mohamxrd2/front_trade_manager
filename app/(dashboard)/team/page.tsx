'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Check, Copy, Loader2, MoreHorizontal, Phone, Plus, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { PermissionGuard } from '@/components/PermissionGuard'
import { keys } from '@/lib/query-keys'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'
import { getTeam, suspendTeamMember, reactivateTeamMember, removeTeamMember, type TeamMember } from '@/lib/services/team'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { formatNumber, formatRelative } from '@/lib/i18n/format'
import type { AppLanguage } from '@/lib/i18n/current-language'
import { roleLabelKey, roleTone } from '@/lib/permissions/role-labels'
import { splitTeamSections } from '@/lib/team/sections'
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
import { MemberActivityPanel } from '@/components/team/member-activity-panel'
import { DeleteMemberDialog } from '@/components/team/delete-member-dialog'

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
    <span className="flex min-w-0 items-center gap-1 text-[12px] text-subtle">
      <span className="sr-only">{t('team.identifier')}</span>
      <span className="truncate font-mono font-semibold text-ink-2" title={username}>{username}</span>
      <button type="button" onClick={copy} aria-label={t('team.copyIdentifierAria')} className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-3">
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
  const router = useRouter()

  const { base, isNegativeBase, isLoading: sharesLoading, collaborators, ownerShare, getShare } = useCollaboratorShares()

  const { data: team, isLoading: teamLoading, error: teamError } = useQuery({ queryKey: keys.team.all, queryFn: getTeam })

  const [filter, setFilter] = React.useState<FilterValue>('all')
  const [activityTarget, setActivityTarget] = React.useState<TeamMember | null>(null)
  const [suspendTarget, setSuspendTarget] = React.useState<TeamMember | null>(null)
  const [reactivateTarget, setReactivateTarget] = React.useState<TeamMember | null>(null)
  const [removeTarget, setRemoveTarget] = React.useState<TeamMember | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<TeamMember | null>(null)
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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setActionPending(true)
    try {
      await removeTeamMember(deleteTarget.id, { permanent: true })
      invalidateTeam()
      toast.success(t('team.toastDeleted', { name: deleteTarget.name }))
      setDeleteTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('team.errorDelete'))
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

  const editHref = (member: TeamMember) => `/team/${member.id}/edit`

  const Avatar = ({ member, index, large }: { member: TeamMember; index: number; large?: boolean }) => {
    const cycle = AVATAR_CYCLE[index % AVATAR_CYCLE.length]
    const size = large ? 'size-14 text-[18px]' : 'size-10 text-[14px] lg:size-12 lg:text-[15px]'
    return member.photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    ) : (
      <span className={`flex ${size} shrink-0 items-center justify-center rounded-full font-extrabold ${cycle.bg} ${cycle.text}`}>
        {getInitials(member.name)}
      </span>
    )
  }

  const Badges = ({ member }: { member: TeamMember }) => (
    <div className="flex flex-wrap items-center gap-1">
      {member.is_owner ? (
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">{t('team.badgeOwner')}</span>
      ) : null}
      {member.role && member.role !== 'owner' ? (
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${roleTone(member.role).bg} ${roleTone(member.role).text}`}>
          {t(roleLabelKey(member.role))}
        </span>
      ) : null}
      {member.is_partner ? (
        <span className="rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-bold text-success-strong">
          {t('team.badgePartner', { share: formatShare(Number(member.part ?? 0), language) })}
        </span>
      ) : null}
      {member.access === 'suspended' ? (
        <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-bold text-danger-strong">{t('team.badgeSuspended')}</span>
      ) : null}
    </div>
  )

  const ActionsMenu = ({ member }: { member: TeamMember }) =>
    member.is_owner ? (
      <Link href="/settings" className="flex h-8 shrink-0 items-center rounded-full border border-line-strong px-3 text-[12px] font-semibold text-ink">
        {t('team.actions.modify')}
      </Link>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('team.actionsMenuAria', { name: member.name })}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2"
          >
            <MoreHorizontal className="size-4" strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(editHref(member))}>{t('team.actions.modify')}</DropdownMenuItem>
          {member.username ? (
            <DropdownMenuItem onSelect={() => router.push(editHref(member))}>{t('team.actions.credentials')}</DropdownMenuItem>
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
          {member.access !== 'none' ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(member)}>
              {t('team.actions.deletePermanently')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    )

  /** Ventes des 30 derniers jours, montant en couleur (indigo). */
  const SalesStat = ({ member, large }: { member: TeamMember; large?: boolean }) =>
    member.last_30_days ? (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{t('team.stats.sales30d')}</span>
        <span className={`truncate font-extrabold text-brand-600 ${large ? 'text-[20px]' : 'text-[16px] lg:text-[18px]'}`}>
          <Amount value={member.last_30_days.total} currency />
        </span>
        <span className="text-xs text-subtle">{t('team.salesCount', { count: member.last_30_days.sales_count })}</span>
      </div>
    ) : null

  /**
   * Direction et associés : MÊME carte que l'ancienne page Collaborateurs
   * (branche main) — part en indigo, montant en vert (rouge si négatif),
   * boutons Modifier / Retirer ; sur mobile, part en pastille à droite. Le
   * menu ⋯ n'apparaît en plus que pour un associé qui a aussi un accès
   * (identifiants, suspension, activité…).
   */
  const LeaderCard = ({ member, index, mobile }: { member: TeamMember; index: number; mobile: boolean }) => {
    const cycle = AVATAR_CYCLE[index % AVATAR_CYCLE.length]
    // Part et montant : même source que la répartition des parts (hook
    // useCollaboratorShares) — le propriétaire n'a pas de fiche associé, sa
    // part est le reste (100 % − associés), recalculée comme sur main.
    const computed = member.is_owner ? ownerShare : getShare(member.collaborator_id ?? member.id)
    const share = computed?.share ?? Number(member.part ?? 0)
    const amount = computed?.amount ?? Number(member.part_amount ?? 0)
    const subtitle = member.is_owner
      ? t('collaborators.ownerRole')
      : member.role
        ? t(roleLabelKey(member.role))
        : t('team.partnerRole')
    const amountClass = amount < 0 ? '' : 'text-success'
    const amountStyle = amount < 0 ? { color: '#A3213A' } : undefined
    const avatar = member.photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.photo} alt="" className={`${mobile ? 'size-12' : 'size-[52px]'} shrink-0 rounded-full object-cover`} />
    ) : (
      <span
        className={`flex ${mobile ? 'size-12 text-[15px]' : 'size-[52px] text-base'} shrink-0 items-center justify-center rounded-full font-extrabold ${cycle.bg} ${cycle.text}`}
      >
        {getInitials(member.name)}
      </span>
    )
    const extraMenu = !member.is_owner && member.access !== 'none' ? <ActionsMenu member={member} /> : null

    if (mobile) {
      return (
        <div className={`flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-3.5 ${member.access === 'suspended' ? 'opacity-70' : ''}`}>
          <div className="flex items-center gap-3">
            {avatar}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-bold text-ink">{member.name}</span>
              <span className="text-[13px] text-subtle">{subtitle}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-full bg-brand-100 px-2.5 py-1.5 text-[13px] font-extrabold text-brand-700">{formatShare(share, language)}</span>
              <span className={`text-xs font-bold ${amountClass}`} style={amountStyle}>
                <Amount value={amount} currency />
              </span>
            </span>
          </div>
          {member.phone || !member.is_owner ? (
            <div className="flex items-center gap-2">
              {member.phone ? (
                <a
                  href={`tel:${member.phone.replace(/\s/g, '')}`}
                  className="flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-full bg-canvas text-[13px] font-semibold text-ink"
                >
                  <Phone className="size-4" strokeWidth={2} />
                  {member.phone}
                </a>
              ) : null}
              {!member.is_owner ? (
                <>
                  <Link
                    href={editHref(member)}
                    className={`flex min-h-[42px] items-center justify-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink ${member.phone ? '' : 'flex-1'}`}
                  >
                    {t('products.detail.modify')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(member)}
                    aria-label={t('collaborators.removeNamedAria', { name: member.name })}
                    className="flex size-[42px] shrink-0 items-center justify-center rounded-full border border-danger-border bg-surface text-danger-strong"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                  {extraMenu}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    }

    return (
      <div className={`flex flex-col gap-3.5 rounded-[24px] bg-surface p-5 shadow-card ${member.access === 'suspended' ? 'opacity-70' : ''}`}>
        <div className="flex items-center gap-3">
          {avatar}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-bold text-ink">{member.name}</span>
            <span className="text-[13px] text-subtle">{subtitle}</span>
          </span>
          {extraMenu}
        </div>
        <dl className="m-0 grid gap-x-3 gap-y-1.5 text-[13px]" style={{ gridTemplateColumns: 'auto 1fr' }}>
          {member.phone ? (
            <>
              <dt className="text-subtle">{t('collaborators.phone')}</dt>
              <dd className="m-0 font-semibold text-ink">{member.phone}</dd>
            </>
          ) : null}
          <dt className="text-subtle">{t('collaborators.share')}</dt>
          <dd className="m-0 font-bold" style={{ color: '#3A20B8' }}>
            {formatShare(share, language)}
          </dd>
          <dt className="text-subtle">{t('transactions.amount')}</dt>
          <dd className={`m-0 font-bold ${amountClass}`} style={amountStyle}>
            <Amount value={amount} currency />
          </dd>
        </dl>
        {!member.is_owner ? (
          <div className="flex gap-2">
            <Link
              href={editHref(member)}
              className="flex min-h-10 flex-1 items-center justify-center rounded-full border border-line-strong bg-surface text-[13px] font-semibold text-ink"
            >
              {t('products.detail.modify')}
            </Link>
            <button
              type="button"
              onClick={() => setRemoveTarget(member)}
              className="flex min-h-10 items-center justify-center rounded-full border border-danger-border bg-surface px-3.5 text-[13px] font-semibold text-danger-strong"
            >
              {t('collaborators.remove')}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  /** Autres membres : carte compacte, ventes (30 j) en couleur. */
  const MemberCard = ({ member, index }: { member: TeamMember; index: number }) => (
    <div
      className={`flex h-full min-w-0 flex-col gap-3 rounded-[20px] border border-line bg-surface p-3 lg:p-4 ${
        member.access === 'suspended' ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Avatar member={member} index={index} />
        <ActionsMenu member={member} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-[14px] font-bold text-ink lg:text-[16px]">{member.name}</span>
        <Badges member={member} />
      </div>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-divider pt-3">
        {member.last_30_days ? (
          <SalesStat member={member} />
        ) : member.username ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{t('team.stats.lastLogin')}</span>
            <span className="truncate text-[14px] font-bold text-ink">
              {member.last_login_at ? formatRelative(member.last_login_at, language) : t('team.stats.neverLoggedIn')}
            </span>
          </div>
        ) : null}
        {member.username ? <IdentifierRow username={member.username} /> : null}
      </div>
    </div>
  )

  const { leaders, others } = splitTeamSections(filteredMembers)

  const SectionTitle = ({ title, hint, count }: { title: string; hint: string; count: number }) => (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold text-ink lg:text-[17px]">{title}</span>
        <span className="text-xs text-subtle">{hint}</span>
      </span>
      <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-bold text-ink-2">{count}</span>
    </div>
  )

  /** Liste en deux sections : direction et associés en haut, le reste de l'équipe en dessous. */
  const renderSections = (mobile: boolean) => {
    if (teamLoading) {
      return (
        <div className={mobile ? 'grid grid-cols-2 gap-2.5' : 'grid gap-3.5'} style={mobile ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))' }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[200px] animate-pulse rounded-[20px] bg-surface-soft" />)}
        </div>
      )
    }
    if (isEmpty) {
      return (
        <div className="flex flex-col items-center gap-1 rounded-panel border border-dashed border-line-strong py-12 text-center">
          <span className="text-base font-bold text-ink">{t('team.emptyTitle')}</span>
          <span className="text-sm text-subtle">{t('team.emptyDescription')}</span>
        </div>
      )
    }
    if (filteredMembers.length === 0) {
      return <p className="py-8 text-center text-sm text-subtle">{t('team.noResultsForFilter')}</p>
    }
    return (
      <div className="flex flex-col gap-6">
        {leaders.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionTitle title={t('team.section.leadership')} hint={t('team.section.leadershipHint')} count={leaders.length} />
            <div
              className={mobile ? 'flex flex-col gap-3' : 'grid gap-3.5'}
              style={mobile ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))' }}
            >
              {leaders.map((m, i) => <LeaderCard key={m.id} member={m} index={i} mobile={mobile} />)}
            </div>
          </section>
        ) : null}
        {others.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionTitle title={t('team.section.members')} hint={t('team.section.membersHint')} count={others.length} />
            <div
              className={mobile ? 'grid grid-cols-2 gap-2.5' : 'grid gap-3.5'}
              style={mobile ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))' }}
            >
              {others.map((m, i) => <MemberCard key={m.id} member={m} index={leaders.length + i} />)}
            </div>
          </section>
        ) : null}
      </div>
    )
  }

  const FILTERS: { value: FilterValue; labelKey: string }[] = [
    { value: 'all', labelKey: 'team.filter.all' },
    { value: 'partners', labelKey: 'team.filter.partners' },
    { value: 'access', labelKey: 'team.filter.access' },
    { value: 'suspended', labelKey: 'team.filter.suspended' },
  ]


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

        {renderSections(false)}
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

        {renderSections(true)}
      </div>

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

      <DeleteMemberDialog
        member={deleteTarget}
        pending={actionPending}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}
