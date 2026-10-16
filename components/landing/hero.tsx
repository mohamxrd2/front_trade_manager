'use client'

import * as React from 'react'
import Link from 'next/link'
import { m, useMotionValue, useSpring } from 'motion/react'

import { EASE, fadeUpBlur, staggerContainer } from '@/lib/motion'

const item = { transition: { duration: 0.8, ease: EASE } }

function HeroScene() {
  const ref = React.useRef<HTMLDivElement>(null)
  const rawRotateX = useMotionValue(0)
  const rawRotateY = useMotionValue(0)
  const rotateX = useSpring(rawRotateX, { stiffness: 120, damping: 14 })
  const rotateY = useSpring(rawRotateY, { stiffness: 120, damping: 14 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    rawRotateY.set(px * 8)
    rawRotateX.set(py * -8)
  }

  const handleMouseLeave = () => {
    rawRotateX.set(0)
    rawRotateY.set(0)
  }

  return (
    <m.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 80, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
      className="wl-scene relative mx-auto mt-12 h-[460px] w-full max-w-[560px] [perspective:1200px] max-[760px]:h-[300px] max-[760px]:scale-[0.78] max-[520px]:scale-[0.56]"
    >
      <m.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative size-full [transform-style:preserve-3d]"
      >
        {/* Halo indigo */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[260px]"
          style={{
            background: 'radial-gradient(60% 60% at 50% 100%, rgba(91,63,230,.28), transparent 70%)',
          }}
        />

        {/* Carte facture sombre, inclinée, en arrière-plan */}
        <div
          className="wl-float2 absolute right-2 top-16 flex w-[220px] flex-col gap-3 rounded-[22px] p-4 text-white"
          style={{
            background: 'radial-gradient(120% 120% at 100% 0%, #3A3AF0 0%, #1717A0 45%, #0A0A4A 100%)',
            boxShadow: '0 20px 44px rgba(10,10,74,.35)',
            transform: 'rotate(6deg)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#C8C8F0]">Facture</span>
            <span className="rounded-full bg-[#0B6B39] px-2 py-0.5 text-[11px] font-bold">Payée</span>
          </div>
          <span className="text-xl font-extrabold tracking-[-0.02em]">138 200 F</span>
          <span className="text-xs text-[#C8C8F0]">Awa Couture</span>
        </div>

        {/* Téléphone, écran d'accueil */}
        <div
          className="wl-float absolute left-0 top-6 flex h-[420px] w-[200px] flex-col gap-3 rounded-[36px] border-[6px] border-[#0E0E1A] bg-white p-3.5"
          style={{ boxShadow: '0 30px 60px rgba(17,17,80,.22)', transform: 'rotate(-6deg)' }}
        >
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-bold text-[#0E0E1A]">Waelly</span>
            <span className="size-5 rounded-full bg-[#5B3FE6]" />
          </div>
          <div
            className="flex flex-col gap-1 rounded-[16px] p-3 text-white"
            style={{ background: 'radial-gradient(120% 120% at 100% 100%, #3A3AF0 0%, #1717A0 60%, #0A0A4A 100%)' }}
          >
            <span className="text-[10px] text-[#C8C8F0]">Solde</span>
            <span className="text-lg font-extrabold">1 245 000 F</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <span className="rounded-[10px] bg-[#F6F5FB] p-2 text-[10px] font-semibold text-[#0B8A43]">+ Vente</span>
            <span className="rounded-[10px] bg-[#F6F5FB] p-2 text-[10px] font-semibold text-[#D92D20]">− Dépense</span>
          </div>
          <div className="flex flex-1 items-end gap-1 rounded-[14px] bg-[#F6F5FB] p-2.5">
            {[40, 65, 50, 80, 60, 95, 70].map((h, i) => (
              <span key={i} className="flex-1 rounded-full bg-[#5B3FE6]/70" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        {/* Bulles flottantes */}
        <m.div
          className="wl-float3 absolute left-[-12px] top-0 rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#0E0E1A]"
          style={{ boxShadow: '0 14px 30px rgba(17,17,80,.16)' }}
        >
          <span className="mr-1 text-[#0B8A43]">✓</span>Facture payée · +36 000 F
        </m.div>
        <div
          className="wl-float absolute bottom-16 left-[-20px] rounded-full bg-white px-3.5 py-2 text-[12px] font-bold text-[#0E0E1A]"
          style={{ boxShadow: '0 14px 30px rgba(17,17,80,.16)' }}
        >
          <span className="mr-1 text-[#0B8A43]">↑</span>12 % ventes cette semaine
        </div>
        <div
          className="wl-float2 absolute bottom-0 right-6 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-[#3F3F50]"
          style={{ boxShadow: '0 14px 30px rgba(17,17,80,.16)' }}
        >
          <span className="size-2 rounded-full bg-[#F77F00]" />
          XOF · FCFA
        </div>
      </m.div>
    </m.div>
  )
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-5 pb-10 pt-[136px] scroll-mt-24">
      <m.div
        variants={staggerContainer(0.12)}
        initial="hidden"
        animate="visible"
        className="mx-auto flex max-w-[760px] flex-col items-center gap-5 text-center"
      >
        <m.span
          variants={fadeUpBlur}
          {...item}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F1FF] px-4 py-1.5 text-[13px] font-bold text-[#3A20B8]"
        >
          Nouveau · Factures PDF à vos couleurs
        </m.span>

        <h1 className="flex flex-col text-[clamp(42px,6.4vw,88px)] font-extrabold leading-[1.02] tracking-[-0.045em] text-[#0E0E1A]">
          <m.span variants={fadeUpBlur} {...item}>
            Votre commerce,
          </m.span>
          <m.span
            variants={fadeUpBlur}
            {...item}
            style={{
              backgroundImage: 'linear-gradient(90deg, #6A4CF0, #3A20B8 55%, #1717A0)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            simplement géré.
          </m.span>
        </h1>

        <m.p variants={fadeUpBlur} {...item} className="max-w-[560px] text-lg text-[#4B4B5C]">
          Stock, ventes, dépenses, factures et équipe : tout votre commerce dans une seule application, sur
          téléphone comme sur ordinateur.
        </m.p>

        <m.div variants={fadeUpBlur} {...item} className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="wl-btn-hover flex h-14 items-center justify-center rounded-full px-7 text-[16px] font-bold text-white max-[520px]:w-full"
            style={{
              background: 'radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)',
              boxShadow: '0 10px 24px rgba(75,47,214,.3)',
            }}
          >
            Commencer gratuitement
          </Link>
          <a
            href="#fonctionnalites"
            className="wl-btn-hover flex h-14 items-center justify-center rounded-full border border-[#E2E2EA] bg-white px-7 text-[16px] font-bold text-[#0E0E1A] max-[520px]:w-full"
          >
            Voir comment ça marche
          </a>
        </m.div>
      </m.div>

      <HeroScene />
    </section>
  )
}
