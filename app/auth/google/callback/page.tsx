'use client'

import { Suspense } from 'react'
import { useSocialAuthCallback } from '@/hooks/useSocialAuthCallback'
import { SocialAuthLoadingScreen } from '@/components/auth/social-auth-loading-screen'

/**
 * Page de retour Google : Google redirige ici avec un ?code=XXXX, à échanger
 * nous-mêmes contre une session Sanctum (voir useSocialAuthCallback).
 */
function GoogleAuthCallbackContent() {
  useSocialAuthCallback('google')
  return <SocialAuthLoadingScreen />
}

export default function GoogleAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleAuthCallbackContent />
    </Suspense>
  )
}
