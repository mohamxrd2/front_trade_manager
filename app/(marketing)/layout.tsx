'use client'

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react'

import { Navbar } from '@/components/landing/navbar'

/**
 * Layout du groupe (marketing) — route "/" : aucun menu latéral ni barre du
 * bas (ce groupe n'est jamais wrappé par app/(dashboard)/layout.tsx).
 * LazyMotion + domAnimation réduit le bundle motion au strict nécessaire
 * (pas de drag/layout avancé ici) ; MotionConfig reducedMotion="user"
 * applique prefers-reduced-motion à TOUTES les animations motion de la page
 * sans avoir à vérifier useReducedMotion() dans chaque composant.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
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
