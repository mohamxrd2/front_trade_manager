import api, { isApiError } from '@/lib/api'
import { isSilentError } from '@/lib/utils/error-handler'

export type OnboardingStatusValue = 'pending' | 'skipped' | 'done'

export interface OnboardingStatus {
  is_complete: boolean
  onboarding_status: OnboardingStatusValue
  /** Étape à reprendre si l'onboarding n'est ni terminé ni passé — 2 (entreprise) ou 3 (préférences). */
  next_step: 2 | 3
  has_company: boolean
  has_settings: boolean
}

interface OnboardingCheckResponse {
  success: boolean
  message?: string
  data?: OnboardingStatus
}

/**
 * Vérifie l'état d'onboarding de l'utilisateur. Un 404 (pas encore de ligne
 * liée) est traité comme "en attente, étape 2" plutôt que comme une erreur.
 */
export async function checkOnboarding(): Promise<OnboardingStatus> {
  try {
    const response = await api.get<OnboardingCheckResponse>('/api/onboarding/check')

    if (response.data.success && response.data.data) {
      return response.data.data
    }

    return { is_complete: false, onboarding_status: 'pending', next_step: 2, has_company: false, has_settings: false }
  } catch (error: unknown) {
    if (isSilentError(error)) {
      throw error
    }

    if (isApiError(error) && error.status === 404) {
      return { is_complete: false, onboarding_status: 'pending', next_step: 2, has_company: false, has_settings: false }
    }

    throw error
  }
}

/**
 * Marque l'onboarding comme terminé (étape 3, bouton « Terminer »). Les
 * données elles-mêmes sont déjà enregistrées via updateCompany() et
 * updateSettings() avant cet appel — celui-ci ne fait que basculer le
 * statut côté serveur.
 */
export async function completeOnboarding(): Promise<void> {
  await api.post('/api/onboarding/complete')
}

/**
 * « Passer pour l'instant » : laisse l'utilisateur accéder au reste de
 * l'app sans avoir rempli son profil entreprise.
 */
export async function skipOnboarding(): Promise<void> {
  await api.post('/api/onboarding/skip')
}
