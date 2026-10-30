'use client'

import { AddPersonForm } from '@/components/team/add-person-form'
import { useCollaboratorShares } from '@/lib/hooks/useCollaboratorShares'

/** « Ajouter une personne » en pleine page — permission team.manage vérifiée par le layout (lib/permissions/route-permissions.ts). */
export default function NewTeamMemberPage() {
  const { remainingShare } = useCollaboratorShares()
  return <AddPersonForm remainingShare={remainingShare} />
}
