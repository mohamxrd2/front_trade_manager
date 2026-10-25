'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'motion/react'
import { Menu, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { EASE } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

const NAV_LINKS = [
  { href: '#top', labelKey: 'landing.navbar.home' },
  { href: '#fonctionnalites', labelKey: 'landing.navbar.features' },
  { href: '#tarifs', labelKey: 'landing.navbar.pricing' },
  { href: '#faq', labelKey: 'landing.navbar.faq' },
]

const SECTION_IDS = ['top', 'fonctionnalites', 'tarifs', 'faq']

function Logo({ light }: { light?: boolean }) {
  return (
    <Link href="#top" className="flex items-center gap-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-base font-extrabold text-white"
        style={{
          background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,.5)',
        }}
      >
        W
      </span>
      <span className={cn('text-lg font-extrabold', light ? 'text-white' : 'text-[#0E0E1A]')}>Waelly</span>
    </Link>
  )
}

function AuthCta({ className }: { className?: string }) {
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  return (
    <Link
      href={isAuthenticated ? '/dashboard' : '/login'}
      className={cn(
        'wl-btn-hover flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-sm font-bold text-white',
        className
      )}
      style={{
        background: 'radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)',
        boxShadow: '0 8px 20px rgba(75,47,214,.35)',
      }}
    >
      {isAuthenticated ? t('landing.navbar.openApp') : t('landing.navbar.login')}
    </Link>
  )
}

/** IntersectionObserver : met en avant le lien de la section actuellement visible. */
function useActiveSection() {
  const [active, setActive] = React.useState('top')

  React.useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  return active
}

export function Navbar() {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const active = useActiveSection()

  React.useEffect(() => {
    const onScroll = () => setScrolled(document.documentElement.scrollTop > 40)
    onScroll()
    document.addEventListener('scroll', onScroll, { passive: true })
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex justify-center transition-[padding] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]"
      style={{ padding: scrolled ? '12px 20px 0' : '18px 20px 0' }}
    >
      <nav
        aria-label={t('landing.navbar.mainNav')}
        className={cn(
          'flex w-full items-center justify-between transition-[max-width,padding,border-radius,background,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]',
          scrolled ? 'max-w-[940px] rounded-full py-2 pr-2 pl-4' : 'max-w-[1180px] rounded-none px-1 py-2'
        )}
        style={
          scrolled
            ? {
                background: 'linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.5))',
                backdropFilter: 'blur(22px) saturate(180%)',
                WebkitBackdropFilter: 'blur(22px) saturate(180%)',
                border: '1px solid rgba(255,255,255,.9)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,.95), 0 14px 34px rgba(17,17,80,.14)',
              }
            : { border: '1px solid transparent' }
        }
      >
        <Logo />

        <div className="wl-links hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                active === link.href.slice(1) ? 'bg-[#0E0E1A] text-white' : 'text-[#3F3F50] hover:text-[#0E0E1A]'
              )}
            >
              {t(link.labelKey)}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <AuthCta />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? t('landing.navbar.closeMenu') : t('landing.navbar.openMenu')}
          aria-expanded={menuOpen}
          className="flex size-11 items-center justify-center rounded-full text-[#0E0E1A] md:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <m.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-x-5 top-[72px] z-50 flex flex-col gap-1 rounded-[28px] p-3 md:hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.75))',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,.9)',
              boxShadow: '0 20px 50px rgba(17,17,80,.18)',
            }}
          >
            {NAV_LINKS.map((link, i) => (
              <m.a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: EASE }}
                className="flex min-h-11 items-center rounded-[18px] px-4 text-[15px] font-semibold text-[#0E0E1A]"
              >
                {t(link.labelKey)}
              </m.a>
            ))}
            <div className="mt-1 px-1 pb-1">
              <AuthCta className="w-full" />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
