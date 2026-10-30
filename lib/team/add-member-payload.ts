import type { AddTeamMemberPayload } from '@/lib/services/team'
import type { PermissionOverride } from '@/lib/services/team'

export interface AddPersonFormValues {
  name: string
  phone?: string
  isPartner: boolean
  share?: number
  hasAccess: boolean
}

export interface AddPersonRoleChoice {
  role: string
  overrides: PermissionOverride[]
}

/**
 * Corps de POST /api/team à partir du formulaire « Ajouter une personne ».
 * Pas d'e-mail : un membre se connecte avec son identifiant
 * ({CODE}-{PRÉNOM}), jamais avec un e-mail.
 */
export function buildAddTeamMemberPayload(values: AddPersonFormValues, roleChoice: AddPersonRoleChoice): AddTeamMemberPayload {
  return {
    name: values.name.trim(),
    phone: values.phone?.trim() || null,
    photo: null,
    is_partner: values.isPartner,
    share: values.isPartner ? Number(values.share) : undefined,
    has_access: values.hasAccess,
    role: values.hasAccess ? roleChoice.role : undefined,
    permissions_overrides: values.hasAccess && roleChoice.overrides.length > 0 ? roleChoice.overrides : undefined,
  }
}
