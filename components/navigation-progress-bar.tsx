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

  // Délai minimum d'affichage une fois démarrée (évite les clignotements)
  minimumDisplayTime: 300,

  // Timeout maximum pour éviter une barre bloquée
  maxDuration: 30000,
}

// Gabarit custom : conserve la structure attendue par les styles .bar/.peg
// (voir globals.css) tout en ajoutant un rôle ARIA lisible par les lecteurs
// d'écran. NProgress sélectionne sa barre via `Settings.barSelector`, qui
// vaut `[role="bar"]` par défaut (pas `.bar`) — garder `role="bar"` ici est
// donc obligatoire, sinon `progress.querySelector('[role="bar"]')` renvoie
// null et NProgress plante sur `null.style` dans son propre `css()`.
// `aria-label`/`aria-valuemin`/`aria-valuemax` restent lisibles par un
// lecteur d'écran même avec `role="bar"` plutôt que `role="progressbar"`.
// Ce module se configure une seule fois au chargement, hors de tout rendu
// React (NProgress gère son propre DOM) : on ne peut donc pas utiliser
// useTranslation() ici — on lit directement `<html lang>`, déjà posé côté
// serveur par RootLayout avant l'hydratation (voir resolveInitialLanguage).
function buildNProgressTemplate(): string {
  const isEnglish = typeof document !== 'undefined' && document.documentElement.lang === 'en'
  const ariaLabel = isEnglish ? 'Loading' : 'Chargement'
  return `<div class="bar" role="bar" aria-label="${ariaLabel}" aria-valuemin="0" aria-valuemax="1" style="transition: all 0 linear;"><div class="peg"></div></div>`
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
    template: buildNProgressTemplate(),
  })
}

// ============================================================================
// HOOK PERSONNALISÉ POUR LA BARRE DE PROGRESSION
// ============================================================================

/**
 * Hook qui gère la logique de la barre de progression
 * Connecté à React Query pour détecter les requêtes en cours
 */
// Exclut les requêtes marquées `meta: { silent: true }` (ex. le polling du
// compteur de notifications non lues) : elles ne doivent JAMAIS déclencher
// la barre, qui reste réservée aux chargements que l'utilisateur perçoit.
const isNotSilent = (query: { meta?: Record<string, unknown> }) => query.meta?.silent !== true

function useProgressBar() {
  // État React Query (les requêtes "silencieuses", ex. le polling des
  // notifications, ne comptent pas — les mutations sont toujours des
  // actions visibles pour l'utilisateur, pas besoin de les filtrer)
  const isFetching = useIsFetching({ predicate: isNotSilent })
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
 * - ✅ Durée minimum d'affichage de 300ms (évite les clignotements)
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

/**
 * À poser sur `aria-busy` du `<main>` de chaque layout — reflète l'état réel
 * de chargement (requêtes non-silencieuses + mutations), indépendamment du
 * délai d'affichage visuel de la barre elle-même.
 */
export function useIsAppBusy(): boolean {
  const isFetching = useIsFetching({ predicate: isNotSilent })
  const isMutating = useIsMutating()
  return isFetching + isMutating > 0
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
