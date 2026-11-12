'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface AuthFlowShellProps {
  icon: React.ReactNode
  title: string
  subtitle: React.ReactNode
  /** Flèche de retour (mobile) : lien. */
  backHref: string
  children: React.ReactNode
}

/**
 * Habillage des écrans « Mot de passe oublié », repris de /verify
 * (maquettes Web-Verification et Verification) : carte en verre centrée sur
 * fond dégradé à partir de 768px, pleine page alignée à gauche sur mobile.
 */
export function AuthFlowShell({ icon, title, subtitle, backHref, children }: AuthFlowShellProps) {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#F3F3F7] px-6 pb-[calc(36px+env(safe-area-inset-bottom))] pt-[calc(56px+env(safe-area-inset-top))] md:items-center md:justify-center md:p-5">
      {/* Fond dégradé de /verify, ordinateur seulement. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            'radial-gradient(700px 500px at 20% 10%, rgba(106,76,240,.28), transparent 70%), radial-gradient(800px 600px at 90% 90%, rgba(58,58,240,.22), transparent 70%), #F1F2F7',
        }}
      />
      <main className="relative flex w-full flex-1 flex-col gap-6 md:max-w-[500px] md:flex-none md:rounded-[32px] md:border md:border-white/90 md:bg-white/70 md:p-10 md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_30px_70px_rgba(17,17,80,0.14)] md:backdrop-blur-2xl">
        <Link
          href={backHref}
          aria-label={t('auth.forgot.back')}
          className="flex size-11 items-center justify-center rounded-full border border-[#ECECF2] bg-white md:hidden"
        >
          <ArrowLeft className="size-5 text-[#0E0E1A]" />
        </Link>

        <div className="flex flex-col items-start gap-3">
          <div className="flex size-16 items-center justify-center rounded-[20px] bg-[#EEEAFE] text-[#5B3FE6]" aria-hidden="true">
            {icon}
          </div>
          <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0E0E1A]">{title}</h1>
          <p className="text-[15px] text-[#6B6B7B]">{subtitle}</p>
        </div>

        {children}
      </main>
    </div>
  )
}
