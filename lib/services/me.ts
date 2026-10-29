import api from '@/lib/api'
import type { AxiosError } from 'axios'
import { isSilentError } from '@/lib/utils/error-handler'

/**
 * Chantier "Équipe" étape 2/3 — endpoints en libre-service pour
 * l'utilisateur CONNECTÉ (propriétaire ou membre), sans permission
 * team.manage.
 */

interface ValidationErrors {
  [key: string]: string[]
}

/**
 * Change son propre code/mot de passe — POST /api/me/change-code (route
 * nommée team.change-password côté backend, seule exemptée du gate
 * must_change_password : c'est le SEUL chemin qui fonctionne tant que
 * must_change_password=true, voir app/(auth)/change-password/page.tsx).
 */
export async function changeMyCode(payload: {
  current_password: string
  new_password: string
  new_password_confirmation: string
}): Promise<void> {
  try {
    await api.post<{ success: boolean; message?: string }>('/api/me/change-code', payload)
  } catch (error: unknown) {
    if (isSilentError(error)) {
      throw error
    }
    const axiosError = error as AxiosError<{ message?: string; errors?: ValidationErrors }>
    if (axiosError.response?.status === 422 && axiosError.response.data?.errors) {
      throw new Error(Object.values(axiosError.response.data.errors).flat().join(', '))
    }
    throw new Error(axiosError.response?.data?.message || 'Erreur lors du changement de code')
  }
}

export async function getMyPermissions(): Promise<string[]> {
  try {
    const response = await api.get<{ success: boolean; data: { permissions: string[] } }>('/api/me/permissions')
    return response.data.data.permissions
  } catch (error: unknown) {
    if (isSilentError(error)) {
      throw error
    }
    throw error
  }
}
