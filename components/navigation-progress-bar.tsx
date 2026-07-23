'use client'

import { useEffect, useRef, useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import NProgress from 'nprogress'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Délai minimum avant d'afficher la barre (évite les flashs sur cache hit)
  showDelay: 150,

  // Délai considéré comme "lent" pour afficher la barre plus visiblement
  slowThreshold: 300,

  // Délai minimum d'affichage une fois démarrée (évite les flashs)
  minimumDisplayTime: 200,

  // Timeout maximum pour éviter une barre bloquée
  maxDuration: 30000,
}

// Configuration NProgress (une seule fois au chargement)
if (typeof window !== 'undefined') {
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 150,
    minimum: 0.15, // Commence à 15% pour éviter l'effet "0 temporaire"
    easing: 'ease-out',
    speed: 300,
    trickle: true,
  })
}

// ============================================================================
// HOOK PERSONNALISÉ POUR LA BARRE DE PROGRESSION
// ============================================================================

/**
 * Hook qui gère la logique de la barre de progression
 * Connecté à React Query pour détecter les requêtes en cours
 */
function useProgressBar() {
  // État React Query
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()

  // Refs pour gérer les timers et l'état
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const isProgressVisibleRef = useRef(false)
  const lastFetchingCountRef = useRef(0)

  // Nettoyer tous les timers
  const clearAllTimers = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current)
      maxDurationTimeoutRef.current = null
    }
  }, [])

  // Arrêter la barre de progression
  // Déclaré avant `startProgress` car ce dernier y fait référence dans son
  // propre callback (ordre requis, `startProgress` en dépend).
  const stopProgress = useCallback(() => {
    if (!isProgressVisibleRef.current) {
      clearAllTimers()
      return
    }

    const elapsed = Date.now() - startTimeRef.current

    // Garantir un temps d'affichage minimum pour éviter les flashs
    if (elapsed < CONFIG.minimumDisplayTime) {
      hideTimeoutRef.current = setTimeout(() => {
        NProgress.done()
        isProgressVisibleRef.current = false
        clearAllTimers()
      }, CONFIG.minimumDisplayTime - elapsed)
    } else {
      NProgress.done()
      isProgressVisibleRef.current = false
      clearAllTimers()
    }
  }, [clearAllTimers])

  // Démarrer la barre de progression
  const startProgress = useCallback(() => {
    if (isProgressVisibleRef.current) return

    isProgressVisibleRef.current = true
    startTimeRef.current = Date.now()

    // Démarrer NProgress
    NProgress.start()

    // Timer de sécurité pour éviter une barre bloquée
    maxDurationTimeoutRef.current = setTimeout(() => {
      stopProgress()
    }, CONFIG.maxDuration)
  }, [stopProgress])

  // Logique principale : surveiller les changements de fetching
  useEffect(() => {
    const totalActive = isFetching + isMutating
    const wasActive = lastFetchingCountRef.current > 0
    const isActive = totalActive > 0

    lastFetchingCountRef.current = totalActive

    // CAS 1: Nouvelles requêtes démarrées
    if (isActive && !wasActive) {
      // Annuler tout timer de masquage en cours
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      // Délai avant d'afficher la barre (évite les flashs sur cache hit rapide)
      if (!isProgressVisibleRef.current && !showTimeoutRef.current) {
        showTimeoutRef.current = setTimeout(() => {
          // Vérifier que les requêtes sont toujours en cours
          if (lastFetchingCountRef.current > 0) {
            startProgress()
          }
          showTimeoutRef.current = null
        }, CONFIG.showDelay)
      }
    }

    // CAS 2: Toutes les requêtes terminées
    if (!isActive && wasActive) {
      // Annuler le timer d'affichage si la barre n'était pas encore visible
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current)
        showTimeoutRef.current = null
      }

      // Arrêter la barre si elle était visible
      if (isProgressVisibleRef.current) {
        stopProgress()
      }
    }

    return () => {
      // Cleanup à la destruction du composant
    }
  }, [isFetching, isMutating, startProgress, stopProgress])

  // Cleanup final au démontage
  useEffect(() => {
    return () => {
      clearAllTimers()
      if (isProgressVisibleRef.current) {
        NProgress.done()
        isProgressVisibleRef.current = false
      }
    }
  }, [clearAllTimers])
}

// ============================================================================
// HOOK POUR LA NAVIGATION (OPTIONNEL)
// ============================================================================

/**
 * Hook qui détecte les changements de route
 * Utilisé en complément pour les navigations sans data fetching
 */
function useRouteChangeDetection() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousPathRef = useRef<string>('')
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const currentPath = `${pathname}${searchParams?.toString() || ''}`

    // Détecter un changement de route
    if (previousPathRef.current && previousPathRef.current !== currentPath) {
      // La navigation s'est produite
      // React Query va gérer la barre via useIsFetching
      // On ne fait rien ici pour éviter les doublons
    }

    previousPathRef.current = currentPath

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [pathname, searchParams])
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

/**
 * Barre de progression intelligente connectée à React Query
 * 
 * Comportement :
 * - ✅ S'affiche UNIQUEMENT si les données ne sont pas en cache
 * - ✅ Ne s'affiche PAS si la page a déjà été visitée (cache hit)
 * - ✅ Se réaffiche si les données ont été invalidées
 * - ✅ Se réaffiche après une mutation qui invalide le cache
 * - ✅ Délai de 150ms avant affichage (évite les flashs)
 * - ✅ Durée minimum d'affichage de 200ms (évite les clignotements)
 * - ✅ Timeout de sécurité de 30s (évite les barres bloquées)
 * 
 * UX similaire à Notion / Vercel / Linear
 */
export function NavigationProgressBar() {
  // Hook principal connecté à React Query
  useProgressBar()

  // Hook optionnel pour détecter les changements de route
  useRouteChangeDetection()

  // Ce composant ne rend rien, NProgress gère son propre DOM
  return null
}

// ============================================================================
// UTILITAIRES EXPORTÉS
// ============================================================================

/**
 * Démarre manuellement la barre de progression
 * Utile pour les actions longues non liées à React Query
 */
export function startProgress(): void {
  if (typeof window !== 'undefined') {
    NProgress.start()
  }
}

/**
 * Arrête manuellement la barre de progression
 */
export function stopProgress(): void {
  if (typeof window !== 'undefined') {
    NProgress.done()
  }
}

/**
 * Met à jour la progression manuellement (0 à 1)
 */
export function setProgress(value: number): void {
  if (typeof window !== 'undefined') {
    NProgress.set(Math.min(Math.max(value, 0), 1))
  }
}

/**
 * Incrémente légèrement la progression
 */
export function incrementProgress(): void {
  if (typeof window !== 'undefined') {
    NProgress.inc()
  }
}
