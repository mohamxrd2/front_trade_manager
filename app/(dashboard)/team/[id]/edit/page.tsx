'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { EditMemberForm } from '@/components/team/edit-member-form'
import { Card } from '@/components/waelly'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { keys } from '@/lib/query-keys'
import { getTeam } from '@/lib/services/team'

/** « Modifier » un membre en pleine page — permission team.manage vérifiée par le layout (lib/permissions/route-permissions.ts). */
export default function EditTeamMemberPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { data: team, isLoading } = useQuery({ queryKey: keys.team.all, queryFn: getTeam })
  const { remainingShare, getShare, isLoading: sharesLoading } = useCollaboratorShares()

  const member = team?.find((m) => m.id === id)

  if (isLoading || sharesLoading) {
    return <div className="h-[420px] animate-pulse rounded-panel bg-surface-soft" />
  }

  if (!member || member.is_owner) {
    return (
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-subtle">{t('team.memberNotFound')}</p>
        <Link href="/team" className="text-sm font-semibold text-brand-600">
          {t('team.backToTeam')}
        </Link>
      </Card>
    )
  }

  // Sa propre part est rendue disponible pour ce formulaire.
  return (
    <EditMemberForm
      member={member}
      remainingShareForEdit={remainingShare + Number(member.part ?? 0)}
      shareAmount={getShare(member.collaborator_id ?? member.id)?.amount ?? member.part_amount}
    />
  )
}
