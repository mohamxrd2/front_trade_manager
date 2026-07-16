'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

// ============================================================================
// TYPES
// ============================================================================

export type MissingField = 'logo' | 'email'

export interface OnboardingStatus {
  needs_onboarding: boolean
  missing_fields: MissingField[]
}

interface UseCompanyOnboardingOptions {
  /** Redirige automatiquement vers l'onboarding si nécessaire */
  redirectIfNeeded?: boolean
  /** Route de redirection pour l'onboarding */
  onboardingRoute?: string
}

interface UseCompanyOnboardingReturn {
  /** Statut de l'onboarding */
  status: OnboardingStatus | null
  /** Chargement en cours */
  isLoading: boolean
  /** Erreur éventuelle */
  error: Error | null
  /** Rafraîchir le statut */
  refresh: () => Promise<void>
  /** Vérifie si un champ spécifique est manquant */
  isMissing: (field: MissingField) => boolean
}

// ============================================================================
// HOOK
// ============================================================================

export function useCompanyOnboarding(
  options: UseCompanyOnboardingOptions = {}
): UseCompanyOnboardingReturn {
  const {
    redirectIfNeeded = false,
    onboardingRoute = '/company/onboarding',
  } = options

  const router = useRouter()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get('/api/company/onboarding-status')
      const data = response.data

      // Debug log
      if (process.env.NODE_ENV !== 'production') {
        console.debug('onboarding-status response:', data)
      }

      // Handle different response formats
      let onboardingStatus: OnboardingStatus

      if (data && typeof data === 'object') {
        // Format: { needs_onboarding, missing_fields }
        if (typeof data.needs_onboarding === 'boolean') {
          onboardingStatus = {
            needs_onboarding: data.needs_onboarding,
            missing_fields: Array.isArray(data.missing_fields) ? data.missing_fields : [],
          }
        }
        // Format: { data: { needs_onboarding, missing_fields } }
        else if (data.data && typeof data.data.needs_onboarding === 'boolean') {
          onboardingStatus = {
            needs_onboarding: data.data.needs_onboarding,
            missing_fields: Array.isArray(data.data.missing_fields) ? data.data.missing_fields : [],
          }
        }
        // Fallback: check company object from /api/user
        else if (data.company || data.user?.company) {
          const company = data.company || data.user?.company
          const missingFields: MissingField[] = []
          if (!company?.logo) missingFields.push('logo')
          if (!company?.email) missingFields.push('email')
          onboardingStatus = {
            needs_onboarding: missingFields.length > 0,
            missing_fields: missingFields,
          }
        }
        // Default: no onboarding needed
        else {
          onboardingStatus = {
            needs_onboarding: false,
            missing_fields: [],
          }
        }
      } else {
        onboardingStatus = {
          needs_onboarding: false,
          missing_fields: [],
        }
      }

      setStatus(onboardingStatus)

      // Redirect if needed
      if (redirectIfNeeded && onboardingStatus.needs_onboarding) {
        router.replace(onboardingRoute)
      }
    } catch (err) {
      console.error('Error fetching onboarding status:', err)
      setError(err instanceof Error ? err : new Error('Erreur lors de la vérification'))
      // En cas d'erreur, on considère que l'onboarding n'est pas nécessaire
      setStatus({ needs_onboarding: false, missing_fields: [] })
    } finally {
      setIsLoading(false)
    }
  }, [redirectIfNeeded, onboardingRoute, router])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const isMissing = useCallback(
    (field: MissingField): boolean => {
      return status?.missing_fields.includes(field) ?? false
    },
    [status]
  )

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
    isMissing,
  }
}

// ============================================================================
// API FUNCTION - Complete Onboarding
// ============================================================================

export async function completeOnboarding(data: {
  email?: string
  logo?: File
}): Promise<{ success: boolean }> {
  const formData = new FormData()

  if (data.email) {
    formData.append('email', data.email)
  }

  if (data.logo) {
    formData.append('logo', data.logo)
  }

  const response = await api.post('/api/company/complete-onboarding', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

