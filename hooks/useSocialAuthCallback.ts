'use client'

import { useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { exchangeSocialAuthCode, type SocialAuthProvider } from '@/lib/services/social-auth'

/**
 * Logique partagée par les pages /auth/<provider>/callback (Google, Facebook) :
 * lit le `code` renvoyé par le provider en query param, l'échange contre une
 * session Sanctum, synchronise le contexte d'auth global, puis redirige vers
 * le dashboard (succès) ou /login?error=social_auth_failed (échec ou code absent).
 *
 * Un code OAuth est à usage unique : il ne doit JAMAIS être envoyé deux fois.
 * Deux garde-fous complémentaires protègent contre ça :
 *
 * 1. `exchangeStarted` (ce hook) : un ref (pas un state) mis à `true` de façon
 *    SYNCHRONE, avant tout `await`, dès la première exécution de l'effect.
 *    Comme il persiste sur l'instance du composant, il bloque aussi bien un
 *    second run causé par un re-render (dépendances de l'effect qui changent
 *    d'identité) que le double-montage volontaire de React 18 Strict Mode en
 *    dev (mount → cleanup → remount sur la même instance). Un tableau de
 *    dépendances vide seul n'aurait pas suffi : Strict Mode rejoue l'effect
 *    même avec `[]`.
 *
 * 2. `skipRetry: true` sur l'appel HTTP lui-même (lib/services/social-auth.ts) :
 *    c'est la protection qui compte le plus en pratique. Le ref ci-dessus ne
 *    protège que contre un second appel déclenché depuis CE composant — il ne
 *    peut rien contre le retry automatique interne à l'instance axios
 *    (lib/api.ts), qui rejoue silencieusement la MÊME requête (même body,
 *    donc même code) sur un 419 CSRF ou une erreur 5xx/réseau.
 */
export function useSocialAuthCallback(provider: SocialAuthProvider) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkAuth } = useAuth()
  const exchangeStarted = useRef(false)

  useEffect(() => {
    // Garde synchrone : pas de "return" implicite entre la lecture et
    // l'écriture, donc pas de fenêtre de course possible ici.
    if (exchangeStarted.current) return
    exchangeStarted.current = true

    const code = searchParams.get('code')

    if (!code) {
      router.replace('/login?error=social_auth_failed')
      return
    }

    const finalizeSocialLogin = async () => {
      try {
        await exchangeSocialAuthCode(provider, code)

        // Synchronise le contexte d'authentification global (état user/isAuthenticated).
        // exchangeSocialAuthCode() n'ayant pas throw ne garantit PAS que la
        // session est reconnue sur l'appel suivant (GET /api/user) — getUser()
        // convertit un 401 en `null` silencieux (pas d'exception), donc sans
        // vérifier le résultat ici on redirigeait vers /dashboard même non
        // authentifié, qui rebondissait ensuite silencieusement vers /login.
        const isNowAuthenticated = await checkAuth()

        if (!isNowAuthenticated) {
          console.error('🚨 [useSocialAuthCallback] Échange OAuth réussi mais session non reconnue par /api/user')
          router.replace('/login?error=social_auth_failed')
          return
        }

        router.replace('/dashboard')
      } catch (error) {
        // TEMPORAIRE — ce catch masquait totalement l'erreur réelle avant.
        // À retirer une fois le social_auth_failed en prod diagnostiqué.
        console.error('🚨 [useSocialAuthCallback] Échec de la finalisation OAuth:', error)
        router.replace('/login?error=social_auth_failed')
      }
    }

    finalizeSocialLogin()
  }, [provider, checkAuth, router, searchParams])
}
