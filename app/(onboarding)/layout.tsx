'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { OnboardingDoneGuard } from '@/components/onboarding/onboarding-done-guard'

/**
 * Layout du groupe (onboarding) — /onboarding, /onboarding/entreprise,
 * /onboarding/preferences : aucun menu latéral ni barre du bas. Nécessite
 * d'être connecté (ProtectedRoute s'en charge, et donc l'email déjà vérifié
 * — un compte non vérifié n'a jamais de session, voir AuthController::login)
 * et redirige vers /dashboard si l'onboarding est déjà marqué 'done'.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <OnboardingDoneGuard>{children}</OnboardingDoneGuard>
    </ProtectedRoute>
  )
}
