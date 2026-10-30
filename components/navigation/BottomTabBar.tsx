'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LazyMotion,
  domMax,
  m,
  useMotionValue,
  useReducedMotion,
  useTransform,
  animate,
} from 'motion/react'

import { cn } from '@/lib/utils'
import { getTabs, resolveActiveTabIndex, isTabBarHidden } from '@/lib/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useTabLens } from '@/hooks/useTabLens'
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen'
import { useScrollShrink } from '@/hooks/useScrollShrink'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

const BUTTON_PRESS_SPRING = { type: 'spring' as const, stiffness: 500, damping: 30 }
const ICON_BOUNCE_SPRING = { type: 'spring' as const, stiffness: 600, damping: 18 }
const BAR_PRESS_SCALE = 0.985

function vibrateTabChange() {
  if (typeof navigator !== 'undefined') {
    navigator.vibrate?.(8)
  }
}

function BottomTabBarInner() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const reducedMotion = useReducedMotion()
  const keyboardOpen = useKeyboardOpen()
  const navRef = React.useRef<HTMLElement>(null)

  // Barre recalculée à chaque changement d'utilisateur/permissions (ex.
  // changement de rôle en cours de session) — voir lib/tabs.ts.
  const TABS = React.useMemo(() => getTabs(user), [user])

  const routeIndex = resolveActiveTabIndex(pathname, TABS)
  const [optimisticIndex, setOptimisticIndex] = React.useState<number | null>(null)

  // La navigation réelle a rattrapé l'intention optimiste : on relâche l'override.
  React.useEffect(() => {
    setOptimisticIndex((current) => (current !== null && routeIndex === current ? null : current))
  }, [routeIndex])

  const settledIndex = optimisticIndex ?? (routeIndex === -1 ? 0 : routeIndex)

  const { navProps, getTabRef, lensMotion, glowOpacity, pressedIndex, dragIndex, isPressing } = useTabLens({
    tabCount: TABS.length,
    activeIndex: settledIndex,
    containerRef: navRef,
    reducedMotion: !!reducedMotion,
    onDragSettle: (index) => {
      setOptimisticIndex(index)
      if (resolveActiveTabIndex(pathname, TABS) !== index) {
        vibrateTabChange()
        router.push(TABS[index].href)
      }
    },
  })

  const displayIndex = dragIndex ?? optimisticIndex ?? routeIndex

  const barPressScale = useMotionValue(1)
  React.useEffect(() => {
    animate(barPressScale, isPressing ? BAR_PRESS_SCALE : 1, BUTTON_PRESS_SPRING)
  }, [isPressing, barPressScale])

  const scrollShrink = useScrollShrink(!!reducedMotion)
  const barScale = useTransform([barPressScale, scrollShrink.scale], ([p, s]) => (p as number) * (s as number))

  const handleTabFocus = (index: number) => {
    if (index === routeIndex) return
    vibrateTabChange()
    setOptimisticIndex(index)
  }

  const handleTabClick = (index: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (resolveActiveTabIndex(pathname, TABS) === index) {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }

  if (isTabBarHidden(pathname, TABS) || keyboardOpen) {
    return null
  }

  return (
    <m.nav
      ref={navRef}
      aria-label={t('nav.mainNav')}
      {...navProps}
      style={{
        ...navProps.style,
        scale: barScale,
        y: scrollShrink.y,
        bottom: 'calc(22px + env(safe-area-inset-bottom))',
      }}
      className="glass fixed inset-x-3.5 z-40 flex h-[72px] gap-0.5 rounded-nav p-1.5 md:hidden"
    >
      <m.div
        aria-hidden="true"
        className="glass-active absolute left-0 inset-y-1.5 rounded-[30px]"
        style={{
          x: lensMotion.x,
          width: lensMotion.width,
          scaleX: lensMotion.scaleX,
          scaleY: lensMotion.scaleY,
          scale: lensMotion.scale,
          opacity: displayIndex === -1 ? 0 : lensMotion.opacity,
          transformOrigin: lensMotion.transformOrigin,
          willChange: 'transform',
        }}
      >
        <m.div className="glass-active-glow absolute inset-0 rounded-[30px]" style={{ opacity: glowOpacity }} />
      </m.div>

      {TABS.map((tab, i) => {
        const active = i === displayIndex
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            ref={getTabRef(i)}
            data-tab-index={i}
            aria-current={active ? 'page' : undefined}
            onFocus={() => handleTabFocus(i)}
            onClick={handleTabClick(i)}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            className={cn(
              'relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-[30px]',
              'text-[11px] tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              active ? 'text-brand-700 font-bold' : 'text-ink-2 font-semibold'
            )}
            style={{ transition: 'color 180ms ease' }}
          >
            <m.span
              animate={{
                scale: pressedIndex === i ? 0.94 : 1,
              }}
              transition={BUTTON_PRESS_SPRING}
              className="flex flex-col items-center gap-[3px]"
            >
              <m.span
                animate={{
                  scale: pressedIndex === i ? 0.85 : 1,
                  y: pressedIndex === i ? 2 : 0,
                }}
                transition={ICON_BOUNCE_SPRING}
                className="flex"
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2 : 1.8} />
              </m.span>
              {t(tab.labelKey)}
            </m.span>
          </Link>
        )
      })}
    </m.nav>
  )
}

/**
 * Barre d'onglets mobile « Liquid Glass » — maquette
 * design/maquettes/mobile/Main.dc.html, bas de l'écran. Doit vivre dans le
 * layout partagé (app/(dashboard)/layout.tsx), jamais dans une page
 * individuelle : c'est ce qui permet à la bulle de glisser au lieu de
 * réapparaître à chaque changement d'onglet.
 */
export function BottomTabBar() {
  return (
    <LazyMotion features={domMax} strict>
      <BottomTabBarInner />
    </LazyMotion>
  )
}
