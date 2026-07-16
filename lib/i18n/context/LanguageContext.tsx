'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useSettings } from '@/contexts/SettingsContext'

type Language = 'fr' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings()
  const [language, setLanguageState] = useState<Language>('fr')
  const [mounted, setMounted] = useState(false)

  // Charger la langue depuis les settings ou localStorage au montage
  useEffect(() => {
    setMounted(true)
    if (settings?.language) {
      // Priorité aux settings de l'API
      setLanguageState(settings.language as Language)
      if (typeof window !== 'undefined') {
        localStorage.setItem('app-language', settings.language)
      }
    } else if (typeof window !== 'undefined') {
      // Fallback sur localStorage
      const savedLanguage = localStorage.getItem('app-language') as Language
      if (savedLanguage && (savedLanguage === 'fr' || savedLanguage === 'en')) {
        setLanguageState(savedLanguage)
      }
    }
  }, [settings?.language])

  // Mettre à jour la langue dans les settings
  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', lang)
    }
    
    // Mettre à jour dans les settings via l'API
    try {
      await updateSettings({ language: lang })
    } catch (error) {
      // L'erreur est déjà gérée dans updateSettings
      console.error('Erreur lors de la mise à jour de la langue:', error)
    }
  }, [updateSettings])

  // Éviter les problèmes d'hydratation
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

