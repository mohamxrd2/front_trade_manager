'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import { toast } from 'sonner'
import { isSilentError } from '@/lib/utils/error-handler'
import { queryClient } from '@/lib/query-client'
import { keys } from '@/lib/query-keys'
import { getCurrentLanguage } from '@/lib/i18n/current-language'
import { mustChangePassword } from '@/lib/permissions/must-change-password'

// SettingsProvider est un ANCÊTRE de LanguageProvider (celui-ci lit
// settings.language) — il ne peut donc pas appeler useTranslation() sans
// créer une dépendance circulaire. Pour ces 2 messages, on lit la langue
// courante directement via le pont (lib/i18n/current-language.ts), sans
// passer par le contexte React.
const SETTINGS_TOASTS = {
  fr: { updated: 'Paramètres mis à jour', updatedDescription: 'Vos paramètres ont été enregistrés avec succès', error: 'Erreur', updateFailed: 'Impossible de mettre à jour les paramètres' },
  en: { updated: 'Settings updated', updatedDescription: 'Your settings were saved successfully', error: 'Error', updateFailed: 'Unable to update settings' },
} as const

interface UserSettings {
  currency: string
  low_stock_threshold: number
  language: string
  /** Préférences « Me prévenir quand… » (page Notifications) — toutes activées par défaut. */
  notify_stock_low: boolean
  notify_invoice_paid: boolean
  notify_invoice_overdue: boolean
  notify_team_joined: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  currency: 'FCFA',
  low_stock_threshold: 80,
  language: 'fr',
  notify_stock_low: true,
  notify_invoice_paid: true,
  notify_invoice_overdue: true,
  notify_team_joined: true,
}

interface SettingsContextType {
  settings: UserSettings | null
  loading: boolean
  updateSettings: (newSettings: Partial<UserSettings>, options?: { silent?: boolean }) => Promise<void>
  refreshSettings: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    if (!user) {
      setSettings(null)
      setLoading(false)
      return
    }

    // Membre qui doit encore changer son code : le backend refuse tout sauf
    // /api/me/change-code (403) — valeurs par défaut, sans requête.
    if (mustChangePassword(user)) {
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }

    try {
      const response = await api.get<{ success: boolean; data?: Partial<UserSettings> }>('/api/user/settings')
      if (response.data.success && response.data.data) {
        const settingsData = response.data.data
        setSettings({
          currency: settingsData.currency || DEFAULT_SETTINGS.currency,
          low_stock_threshold: settingsData.low_stock_threshold || DEFAULT_SETTINGS.low_stock_threshold,
          language: settingsData.language || DEFAULT_SETTINGS.language,
          notify_stock_low: settingsData.notify_stock_low ?? DEFAULT_SETTINGS.notify_stock_low,
          notify_invoice_paid: settingsData.notify_invoice_paid ?? DEFAULT_SETTINGS.notify_invoice_paid,
          notify_invoice_overdue: settingsData.notify_invoice_overdue ?? DEFAULT_SETTINGS.notify_invoice_overdue,
          notify_team_joined: settingsData.notify_team_joined ?? DEFAULT_SETTINGS.notify_team_joined,
        })
      } else {
        // Valeurs par défaut si pas de données
        setSettings(DEFAULT_SETTINGS)
      }
    } catch (error) {
      // Vérifier si c'est une erreur silencieuse
      if (isSilentError(error)) {
        return
      }

      const axiosError = error as { response?: { status?: number } }

      // Si erreur 404, pas de settings encore, utiliser les valeurs par défaut
      if (axiosError?.response?.status === 404) {
        setSettings(DEFAULT_SETTINGS)
      } else {
        // Pour les autres erreurs, utiliser les valeurs par défaut
        if (process.env.NODE_ENV !== 'production') {
          console.error('Erreur lors de la récupération des paramètres:', error)
        }
        setSettings(DEFAULT_SETTINGS)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>, options?: { silent?: boolean }) => {
    try {
      const response = await api.put<{ success: boolean; message?: string; data?: UserSettings }>('/api/user/settings', newSettings)
      if (response.data.success) {
        setSettings((prev) => ({
          ...prev!,
          ...newSettings,
        }))

        // Seuil de stock faible → le statut "stock faible" des articles en
        // dépend directement. Devise → purement un format d'affichage côté
        // client (lib/utils/currency.ts), mais tout ce qui affiche un
        // montant doit se re-rendre avec le nouveau symbole immédiatement,
        // d'où l'invalidation large plutôt qu'un simple re-render local.
        if ('low_stock_threshold' in newSettings || 'currency' in newSettings) {
          void queryClient.invalidateQueries({ queryKey: keys.products.all })
          void queryClient.invalidateQueries({ queryKey: keys.wallet.all })
          void queryClient.invalidateQueries({ queryKey: keys.analytics.all })
          void queryClient.invalidateQueries({ queryKey: keys.dashboard.all })
          void queryClient.invalidateQueries({ queryKey: keys.invoices.all })
        }

        if (!options?.silent) {
          const t = SETTINGS_TOASTS[getCurrentLanguage()]
          toast.success(t.updated, { description: t.updatedDescription })
        }
      } else {
        throw new Error(response.data.message || 'Erreur lors de la mise à jour')
      }
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse
      if (isSilentError(error)) {
        throw error
      }

      const axiosError = error as { response?: { data?: { message?: string } } }
      const t = SETTINGS_TOASTS[getCurrentLanguage()]
      const errorMessage = axiosError?.response?.data?.message || t.updateFailed

      toast.error(t.error, {
        description: errorMessage,
      })
      throw error
    }
  }, [])

  // Charger les paramètres au montage et quand l'utilisateur change
  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

