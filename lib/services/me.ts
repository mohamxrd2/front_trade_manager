import api, { isApiError } from '@/lib/api'
import type { MyDay, User } from '@/lib/auth'
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
    // error.response.data n'existe plus à ce stade — lib/api.ts aplatit déjà
    // l'erreur (error.status/.errors/.message directement), voir le même
    // correctif dans lib/services/team.ts pour le détail.
    if (isApiError(error)) {
      const validationErrors = error.errors as ValidationErrors | undefined
      if (error.status === 422 && validationErrors) {
        throw new Error(Object.values(validationErrors).flat().join(', '))
      }
      throw new Error(error.message || 'Erreur lors du changement de code')
    }
    throw new Error('Erreur lors du changement de code')
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

/**
 * « Ma caisse du jour » d'un membre sans wallet.view_balance — calculée par
 * GET /api/user (my_day). Requête dédiée (et non l'utilisateur chargé à la
 * connexion) pour être rafraîchie après chaque vente/dépense.
 */
export async function getMyDay(): Promise<MyDay | null> {
  const response = await api.get<User>('/api/user')
  return response.data.my_day ?? null
}

