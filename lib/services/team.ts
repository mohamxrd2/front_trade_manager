import api from '@/lib/api'
import type { AxiosError } from 'axios'
import { isSilentError } from '@/lib/utils/error-handler'

/**
 * Chantier "Équipe" étape 2/3 — endpoint UNIFIÉ /api/team (associés ET
 * membres). Distinct de lib/services/collaborators.ts (/api/collaborators,
 * conservé côté backend pour compatibilité, mais plus utilisé par cette
 * interface — seule la carte "Répartition des parts" continue de s'appuyer
 * dessus via useCollaboratorShares()).
 */

export interface TeamMemberLast30Days {
  sales_count: number
  total: number
}

/** Une personne de l'équipe — le propriétaire, un associé, un membre, ou les deux. */
export interface TeamMember {
  id: string
  name: string
  photo: string | null
  phone: string | null
  email: string | null
  is_owner: boolean
  is_partner: boolean
  part: number | null
  part_amount: number | null
  access: 'none' | 'active' | 'suspended'
  role: string | null
  username: string | null
  permissions: string[]
  last_login_at: string | null
  last_30_days: TeamMemberLast30Days | null
}

export interface TeamCredentials {
  username: string
  code: string
  login_url: string
}

export interface PermissionOverride {
  permission: string
  granted: boolean
}

export interface AddTeamMemberPayload {
  name: string
  phone?: string | null
  email?: string | null
  photo?: string | null
  is_partner?: boolean
  share?: number
  has_access?: boolean
  role?: string
  permissions_overrides?: PermissionOverride[]
}

export interface UpdateTeamMemberPayload {
  name?: string
  phone?: string | null
  email?: string | null
  photo?: string | null
  share?: number
  role?: string
  permissions_overrides?: PermissionOverride[]
}

export interface GrantAccessPayload {
  role: string
  permissions_overrides?: PermissionOverride[]
}

export interface RoleDefinition {
  role: string
  label: { fr: string; en: string }
  permissions: string[]
}

export interface ActivityLogEntry {
  id: string
  account_id: string
  user_id: string
  action: string
  subject_type: string | null
  subject_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface ActivityLogMeta {
  total: number
  page: number
  per_page: number
  total_pages: number
}

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export interface ValidationErrors {
  [key: string]: string[]
}

/** Erreur enrichie avec les erreurs de validation par champ (422), même convention que lib/services/collaborators.ts. */
export class TeamApiError extends Error {
  validationErrors?: ValidationErrors
}

function handleTeamError(error: unknown, fallback: string): never {
  if (isSilentError(error)) {
    throw error
  }

  const axiosError = error as AxiosError<{ message?: string; errors?: ValidationErrors }>
  const status = axiosError.response?.status

  if (status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new Error('Non authentifié')
  }

  if (status === 404) {
    throw new Error(axiosError.response?.data?.message || 'Personne non trouvée')
  }

  if (status === 403) {
    throw new Error(axiosError.response?.data?.message || 'Non autorisé')
  }

  if (status === 422) {
    const validationErrors = axiosError.response?.data?.errors || {}
    const firstFieldMessage = Object.values(validationErrors)[0]?.[0]
    const message = axiosError.response?.data?.message || firstFieldMessage || 'Erreur de validation'
    const err = new TeamApiError(message)
    err.validationErrors = validationErrors
    throw err
  }

  if (axiosError.response?.data?.message) {
    throw new Error(axiosError.response.data.message)
  }

  throw new Error(fallback)
}

export async function getTeam(): Promise<TeamMember[]> {
  try {
    const response = await api.get<ApiResponse<TeamMember[]>>('/api/team')
    return response.data.data
  } catch (error) {
    handleTeamError(error, "Erreur lors de la récupération de l'équipe")
  }
}

export async function addTeamMember(
  payload: AddTeamMemberPayload
): Promise<{ team_member: TeamMember; credentials?: TeamCredentials }> {
  try {
    const response = await api.post<ApiResponse<{ team_member: TeamMember; credentials?: TeamCredentials }>>(
      '/api/team',
      payload
    )
    return response.data.data
  } catch (error) {
    handleTeamError(error, "Erreur lors de l'ajout à l'équipe")
  }
}

export async function updateTeamMember(
  id: string,
  payload: UpdateTeamMemberPayload
): Promise<{ team_member: TeamMember }> {
  try {
    const response = await api.patch<ApiResponse<{ team_member: TeamMember }>>(`/api/team/${id}`, payload)
    return response.data.data
  } catch (error) {
    handleTeamError(error, 'Erreur lors de la mise à jour')
  }
}

export async function grantTeamAccess(
  id: string,
  payload: GrantAccessPayload
): Promise<{ team_member: TeamMember; credentials: TeamCredentials }> {
  try {
    const response = await api.post<ApiResponse<{ team_member: TeamMember; credentials: TeamCredentials }>>(
      `/api/team/${id}/access`,
      payload
    )
    return response.data.data
  } catch (error) {
    handleTeamError(error, "Erreur lors de la création de l'accès")
  }
}

export async function suspendTeamMember(id: string): Promise<void> {
  try {
    await api.post(`/api/team/${id}/suspend`)
  } catch (error) {
    handleTeamError(error, 'Erreur lors de la suspension')
  }
}

export async function reactivateTeamMember(id: string): Promise<void> {
  try {
    await api.post(`/api/team/${id}/reactivate`)
  } catch (error) {
    handleTeamError(error, 'Erreur lors de la réactivation')
  }
}

export async function resetTeamMemberCode(id: string): Promise<{ login_code: string }> {
  try {
    const response = await api.post<ApiResponse<{ login_code: string }>>(`/api/team/${id}/reset-code`)
    return response.data.data
  } catch (error) {
    handleTeamError(error, 'Erreur lors de la réinitialisation du code')
  }
}

export async function removeTeamMember(id: string): Promise<void> {
  try {
    await api.delete(`/api/team/${id}`)
  } catch (error) {
    handleTeamError(error, 'Erreur lors du retrait')
  }
}

export async function getTeamRoles(): Promise<RoleDefinition[]> {
  try {
    const response = await api.get<ApiResponse<RoleDefinition[]>>('/api/team/roles')
    return response.data.data
  } catch (error) {
    handleTeamError(error, 'Erreur lors de la récupération des rôles')
  }
}

export async function getTeamActivity(params?: {
  member?: string
  page?: number
  per_page?: number
}): Promise<{ data: ActivityLogEntry[]; meta: ActivityLogMeta }> {
  try {
    const response = await api.get<{ success: boolean; data: ActivityLogEntry[]; meta: ActivityLogMeta }>(
      '/api/team/activity',
      { params }
    )
    return { data: response.data.data, meta: response.data.meta }
  } catch (error) {
    handleTeamError(error, "Erreur lors de la récupération du journal d'activité")
  }
}
