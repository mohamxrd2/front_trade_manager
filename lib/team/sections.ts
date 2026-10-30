import type { TeamMember } from '@/lib/services/team'

/**
 * Page Équipe : la direction en haut (propriétaire, gérants, associés),
 * le reste de l'équipe en dessous — chaque groupe dans l'ordre reçu du
 * serveur (propriétaire en premier).
 */
export function isLeadershipMember(member: Pick<TeamMember, 'is_owner' | 'is_partner' | 'role'>): boolean {
  return member.is_owner || member.is_partner || member.role === 'manager'
}

export function splitTeamSections<T extends Pick<TeamMember, 'is_owner' | 'is_partner' | 'role'>>(members: T[]): { leaders: T[]; others: T[] } {
  return {
    leaders: members.filter(isLeadershipMember),
    others: members.filter((m) => !isLeadershipMember(m)),
  }
}
