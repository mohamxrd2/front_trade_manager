'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useSettings } from '@/contexts/SettingsContext'
import {
  type AppLanguage,
  setCurrentLanguage,
  writeLanguageCookie,
} from '@/lib/i18n/current-language'

type Language = AppLanguage

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
  /**
   * Langue déjà résolue côté serveur (cookie `app-language` lu dans
   * app/layout.tsx via next/headers) — évite tout clignotement : le premier
   * rendu client est identique au rendu serveur (même valeur), pas besoin
   * d'un garde-fou "mounted" qui affiche un état transitoire différent.
   */
  initialLanguage: Language
}

export function LanguageProvider({ children, initialLanguage }: LanguageProviderProps) {
  const { settings, updateSettings } = useSettings()
  const [language, setLanguageState] = useState<Language>(initialLanguage)

  // Applique la langue partout où React ne peut pas intervenir directement :
  // <html lang>, le cookie (pages publiques + prochain SSR), et le pont lu
  // par l'intercepteur axios (en-tête Accept-Language, hors arbre React).
  useEffect(() => {
    document.documentElement.lang = language
    writeLanguageCookie(language)
    setCurrentLanguage(language)
  }, [language])

  // Une fois les settings du compte chargés, ils font autorité (ex. un
  // utilisateur qui se connecte sur un nouvel appareil où le cookie local
  // dit encore "fr" mais dont le compte est en "en").
  useEffect(() => {
    if (settings?.language && (settings.language === 'fr' || settings.language === 'en')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronise un store externe (SettingsContext, lui-même alimenté par une requête réseau) dans l'état local ; pas dérivable pendant le rendu.
      setLanguageState(settings.language)
    }
  }, [settings?.language])

  // Changement immédiat (avant même la réponse serveur) : l'UI entière
  // bascule tout de suite, la persistance en base suit en arrière-plan — en
  // cas d'échec, le prochain chargement des settings resynchronisera de
  // toute façon (pas de rollback visuel nécessaire pour un simple réglage
  // d'affichage, contrairement à une mutation de données métier).
  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang)

    try {
      await updateSettings({ language: lang }, { silent: true })
    } catch {
      // Déjà notifié par updateSettings (toast d'erreur) — l'état local
      // reste sur la langue choisie, l'utilisateur n'est pas bloqué par un
      // échec de sauvegarde pour un simple changement d'affichage.
    }
  }, [updateSettings])

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
