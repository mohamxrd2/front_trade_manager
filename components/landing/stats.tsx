'use client'

import * as React from 'react'
import { m } from 'motion/react'

import { fadeUp, revealViewport, transitionBase } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/** Décompte 0→1 déclenché une seule fois quand la section entre dans le viewport (seuil 30 %), easing cubique sur 1700ms — reprend exactement la logique de Presentation.dc.html. */
function useCountK() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [k, setK] = React.useState(0)
  const started = React.useRef(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const start = () => {
      if (started.current) return
      started.current = true
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 1700)
        setK(1 - Math.pow(1 - p, 3))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setK(1)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start()
          io.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  return { ref, k }
}

const RADIUS = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function StatItem({ value, suffix, caption }: { value: number; suffix: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-extrabold tracking-[-0.03em] text-[clamp(34px,4vw,48px)] [font-variant-numeric:tabular-nums]">
        {value}
        <span className="text-[0.5em] text-[#5B3FE6]"> {suffix}</span>
      </span>
      <span className="text-[13px] text-[#6B6B7B]">{caption}</span>
    </div>
  )
}

export function Stats() {
  const { t } = useTranslation()
  const { ref, k } = useCountK()
  const ring = 78 * k
  const dash = `${((CIRCUMFERENCE * ring) / 100).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`

  return (
    <section ref={ref} className="mx-auto flex max-w-[1180px] flex-col gap-7 px-5 pt-10">
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex flex-wrap items-end gap-7 gap-x-12"
      >
        <p className="m-0 max-w-[360px] flex-[1_1_300px] text-lg leading-[1.5] text-[#4B4B5C]">
          {t('landing.stats.intro')}
        </p>
        <div className="grid flex-[2_1_520px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6">
          <StatItem value={Math.round(6 * k)} suffix={t('landing.stats.modulesSuffix')} caption={t('landing.stats.modulesCaption')} />
          <StatItem value={Math.round(2 * k)} suffix={t('landing.stats.screensSuffix')} caption={t('landing.stats.screensCaption')} />
          <StatItem value={Math.round(3 * k)} suffix={t('landing.stats.stepsSuffix')} caption={t('landing.stats.stepsCaption')} />
        </div>
      </m.div>

      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex flex-wrap gap-4 rounded-[30px] border border-[#ECE8FF] bg-[#F3F1FB] p-4"
      >
        <div className="wl-card-hover flex min-w-0 flex-[2_1_380px] flex-wrap gap-4 rounded-[24px] bg-white p-5">
          <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex">
                <span className="flex size-[34px] items-center justify-center rounded-full border-2 border-white bg-[#EEEAFE] text-xs font-extrabold text-[#4B2FD6]">
                  AK
                </span>
                <span className="-ml-2.5 flex size-[34px] items-center justify-center rounded-full border-2 border-white bg-[#FFF0E0] text-xs font-extrabold text-[#8A4B00]">
                  MD
                </span>
                <span className="-ml-2.5 flex size-[34px] items-center justify-center rounded-full border-2 border-white bg-[#E6EEFF] text-xs font-extrabold text-[#1F3FB8]">
                  KY
                </span>
              </span>
              <span className="text-xl font-extrabold">{t('landing.stats.allBusinesses')}</span>
            </div>
            <p className="m-0 text-[13px] leading-[1.5] text-[#6B6B7B]">
              {t('landing.stats.allBusinessesDescription')}
            </p>
          </div>
          <div
            className="flex min-w-0 flex-[1_1_200px] items-center justify-between gap-3 rounded-[20px] p-4 text-white"
            style={{
              background: 'radial-gradient(120% 120% at 100% 100%, #3A3AF0 0%, #1717A0 40%, #0A0A4A 85%)',
              boxShadow: '0 14px 30px rgba(16,16,120,.24)',
            }}
          >
            <span className="flex flex-col gap-1">
              <span className="text-xs text-[#C8C8F0]">{t('landing.stats.monthlyGoal')}</span>
              <span className="text-[22px] font-extrabold">{t('landing.stats.monthlyGoalTarget')}</span>
              <span className="text-xs text-[#C8C8F0]">{t('landing.stats.monthlyGoalReached')}</span>
            </span>
            <span className="relative size-[74px] shrink-0">
              <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden="true">
                <circle cx="37" cy="37" r={RADIUS} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="7" />
                <circle
                  cx="37"
                  cy="37"
                  r={RADIUS}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  transform="rotate(-90 37 37)"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold">
                {Math.round(ring)} %
              </span>
            </span>
          </div>
        </div>

        <div className="wl-card-hover flex min-w-0 flex-[1_1_220px] flex-col gap-2.5 rounded-[24px] bg-white p-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#EEEAFE] text-[#5B3FE6]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
            </svg>
          </span>
          <span className="text-base font-bold">{t('landing.stats.realtimeTitle')}</span>
          <span className="text-[13px] leading-[1.5] text-[#6B6B7B]">
            {t('landing.stats.realtimeDescription')}
          </span>
        </div>

        <div className="wl-card-hover flex min-w-0 flex-[1_1_220px] flex-col gap-2.5 rounded-[24px] bg-white p-5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#EEEAFE] text-[#5B3FE6]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h6" />
            </svg>
          </span>
          <span className="text-base font-bold">{t('landing.stats.invoicingTitle')}</span>
          <span className="text-[13px] leading-[1.5] text-[#6B6B7B]">
            {t('landing.stats.invoicingDescription')}
          </span>
        </div>
      </m.div>
    </section>
  )
}
