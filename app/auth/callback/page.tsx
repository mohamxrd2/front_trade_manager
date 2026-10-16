'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getUser } from '@/lib/auth'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

/**
 * Page de retour après connexion sociale (Google/Facebook).
 *
 * Le backend a déjà posé le cookie de session Sanctum avant de rediriger ici :
 * on n'a qu'à vérifier que la session est bien active via GET /api/user.
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const { checkAuth } = useAuth()
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const finalizeSocialLogin = async () => {
      try {
        const user = await getUser()

        if (!user) {
          router.replace('/login?error=social_auth_failed')
          return
        }

        // Synchronise le contexte d'authentification global (état user/isAuthenticated)
        await checkAuth()
        router.replace('/dashboard')
      } catch {
        router.replace('/login?error=social_auth_failed')
      }
    }

    finalizeSocialLogin()
  }, [checkAuth, router])

  return <FullPageSpinner />
}
