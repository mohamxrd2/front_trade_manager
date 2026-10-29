'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { homeRouteForUser } from '@/lib/permissions/home-route'
import { AuthLogo } from '@/components/auth'
import { ChangeCodeForm } from '@/components/auth/change-code-form'
import { FullPageSpinner } from '@/components/ui/full-page-spinner'

/**
 * Chantier "Équipe" §5 — affiché juste après la connexion d'un membre dont
 * `must_change_password` est vrai (code temporaire imposé à la création ou
 * après réinitialisation). Route autonome (ni (auth) — AuthRoute y
 * redirigerait tout utilisateur déjà connecté vers /dashboard —, ni
 * (dashboard) — pas de menu, rien d'autre accessible avant d'avoir changé
 * de code, voir Gate::before côté backend qui bloque tout sauf
 * /api/me/change-code pendant que must_change_password est vrai).
 */
export default function ChangePasswordPage() {
  const { user, loading, checkAuth } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (!user.must_change_password) {
      router.replace(homeRouteForUser(user))
    }
  }, [user, loading, router])

  const handleSuccess = async () => {
    await checkAuth()
    router.replace(homeRouteForUser(user))
  }

  if (loading || !user || !user.must_change_password) {
    return <FullPageSpinner />
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#F3F3F7] px-5 py-10">
      <AuthLogo size={40} />
      <ChangeCodeForm onSuccess={handleSuccess} />
    </div>
  )
}
