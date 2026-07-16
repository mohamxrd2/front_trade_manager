'use client'

import { Suspense } from 'react'
import { useSocialAuthCallback } from '@/hooks/useSocialAuthCallback'
import { SocialAuthLoadingScreen } from '@/components/auth/social-auth-loading-screen'

/**
 * Page de retour Facebook : Facebook redirige ici avec un ?code=XXXX, à
 * échanger nous-mêmes contre une session Sanctum (voir useSocialAuthCallback).
 */
function FacebookAuthCallbackContent() {
  useSocialAuthCallback('facebook')
  return <SocialAuthLoadingScreen />
}

export default function FacebookAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <FacebookAuthCallbackContent />
    </Suspense>
  )
}
