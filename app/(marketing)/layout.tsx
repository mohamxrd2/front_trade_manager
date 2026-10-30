'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'

import { Navbar } from '@/components/landing/navbar'
import { useAuth } from '@/contexts/AuthContext'
import { homeRouteForUser } from '@/lib/permissions/home-route'

/**
 * Layout du groupe (marketing) — route "/" : aucun menu latéral ni barre du
 * bas (ce groupe n'est jamais wrappé par app/(dashboard)/layout.tsx).
 * LazyMotion + domAnimation réduit le bundle motion au strict nécessaire
 * (pas de drag/layout avancé ici) ; MotionConfig reducedMotion="user"
 * applique prefers-reduced-motion à TOUTES les animations motion de la page
 * sans avoir à vérifier useReducedMotion() dans chaque composant.
 *
 * Redirection « déjà connecté » : contrairement à AuthRoute (login/signup),
 * pas de spinner bloquant pendant la vérification — la page de présentation
 * doit rester rapide au premier rendu pour les visiteurs anonymes (la
 * grande majorité). Un utilisateur déjà connecté qui ouvre "/" voit la page
 * de présentation une fraction de seconde puis est redirigé vers
 * /dashboard dès que l'état d'authentification est connu.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(homeRouteForUser(user))
    }
  }, [user, isAuthenticated, loading, router])

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[#FBFBFE] text-[#0E0E1A]" style={{ overflowX: 'clip' }}>
          <Navbar />
          {children}
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
