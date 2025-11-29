'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'
import { toast } from 'sonner'
import { isSilentError } from '@/lib/utils/error-handler'

interface UserSettings {
  currency: string
  low_stock_threshold: number
  language: string
}

interface SettingsContextType {
  settings: UserSettings | null
  loading: boolean
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>
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

    try {
      const response = await api.get<{ success: boolean; data?: UserSettings }>('/api/user/settings')
      if (response.data.success && response.data.data) {
        const settingsData = response.data.data
        setSettings({
          currency: settingsData.currency || 'FCFA',
          low_stock_threshold: settingsData.low_stock_threshold || 80,
          language: settingsData.language || 'fr',
        })
      } else {
        // Valeurs par défaut si pas de données
        setSettings({
          currency: 'FCFA',
          low_stock_threshold: 80,
          language: 'fr',
        })
      }
    } catch (error) {
      // Vérifier si c'est une erreur silencieuse
      if (isSilentError(error)) {
        return
      }

      const axiosError = error as { response?: { status?: number } }
      
      // Si erreur 404, pas de settings encore, utiliser les valeurs par défaut
      if (axiosError?.response?.status === 404) {
        setSettings({
          currency: 'FCFA',
          low_stock_threshold: 80,
          language: 'fr',
        })
      } else {
        // Pour les autres erreurs, utiliser les valeurs par défaut
        if (process.env.NODE_ENV !== 'production') {
          console.error('Erreur lors de la récupération des paramètres:', error)
        }
        setSettings({
          currency: 'FCFA',
          low_stock_threshold: 80,
          language: 'fr',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      const response = await api.put<{ success: boolean; message?: string; data?: UserSettings }>('/api/user/settings', newSettings)
      if (response.data.success) {
        setSettings((prev) => ({
          ...prev!,
          ...newSettings,
        }))
        toast.success('Paramètres mis à jour', {
          description: 'Vos paramètres ont été enregistrés avec succès',
        })
      } else {
        throw new Error(response.data.message || 'Erreur lors de la mise à jour')
      }
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse
      if (isSilentError(error)) {
        throw error
      }

      const axiosError = error as { response?: { data?: { message?: string } } }
      const errorMessage = axiosError?.response?.data?.message || 'Impossible de mettre à jour les paramètres'
      
      toast.error('Erreur', {
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

