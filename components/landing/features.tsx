'use client'

import { m } from 'motion/react'

import { EASE, fadeUp, fadeUpBlur, revealViewport, staggerContainer, transitionBase } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

function SectionHeading() {
  const { t } = useTranslation()
  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      variants={staggerContainer(0.1)}
      className="flex max-w-[680px] flex-col items-center gap-3.5 text-center"
    >
      <m.span variants={fadeUp} transition={transitionBase} className="text-[13px] font-bold uppercase tracking-[0.06em] text-[#5B3FE6]">
        {t('landing.features.eyebrow')}
      </m.span>
      <m.h2
        variants={fadeUp}
        transition={transitionBase}
        className="m-0 text-[clamp(32px,4.2vw,52px)] font-extrabold leading-[1.08] tracking-[-0.035em]"
      >
        {t('landing.features.title')}
      </m.h2>
      <m.p variants={fadeUp} transition={transitionBase} className="m-0 text-[17px] leading-[1.55] text-[#6B6B7B]">
        {t('landing.features.subtitle')}
      </m.p>
    </m.div>
  )
}

function SalesChartCard() {
  const { t } = useTranslation()
  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      variants={fadeUpBlur}
      transition={transitionBase}
      className="wl-card-hover flex flex-col gap-2.5 rounded-[28px] border border-[#ECECF2] bg-white p-6"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#EEEAFE] text-lg font-extrabold text-[#5B3FE6]">
        ↗
      </span>
      <span className="text-xl font-bold">{t('landing.features.salesCard.title')}</span>
      <span className="text-sm leading-[1.55] text-[#6B6B7B]">
        {t('landing.features.salesCard.description')}
      </span>
      <div className="mt-2 rounded-[20px] border border-[#F0EEF8] bg-[#F7F6FC] p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-bold">{t('landing.features.salesCard.chartLabel')}</span>
          <span className="text-xs font-bold text-[#0B8A43]">↑ 12 %</span>
        </div>
        <svg viewBox="0 0 320 120" width="100%" height="120" role="img" aria-label={t('landing.features.salesCard.chartAria')} className="mt-2 block">
          <defs>
            <linearGradient id="wl-sales-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6A4CF0" stopOpacity="0.32" />
              <stop offset="1" stopColor="#6A4CF0" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="30" x2="320" y2="30" stroke="#E6E3F3" strokeDasharray="3 4" />
          <line x1="0" y1="70" x2="320" y2="70" stroke="#E6E3F3" strokeDasharray="3 4" />
          <line x1="0" y1="110" x2="320" y2="110" stroke="#E6E3F3" strokeDasharray="3 4" />
          <path
            d="M0 80 C 30 80, 40 60, 60 62 S 100 90, 125 84 S 160 40, 185 46 S 225 60, 250 44 S 290 18, 320 16 L 320 110 L 0 110 Z"
            fill="url(#wl-sales-grad)"
          />
          <m.path
            d="M0 80 C 30 80, 40 60, 60 62 S 100 90, 125 84 S 160 40, 185 46 S 225 60, 250 44 S 290 18, 320 16"
            fill="none"
            stroke="#5B3FE6"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={revealViewport}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <circle cx="250" cy="44" r="6" fill="#FFFFFF" stroke="#5B3FE6" strokeWidth="3" />
          <rect x="214" y="8" width="72" height="22" rx="11" fill="#FFFFFF" stroke="#E2E2EA" />
          <text x="250" y="23" fontSize="11" fontWeight="700" fill="#0E0E1A" textAnchor="middle">
            312 000
          </text>
        </svg>
      </div>
    </m.div>
  )
}

function ForecastChartCard() {
  const { t } = useTranslation()
  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      variants={fadeUpBlur}
      transition={{ ...transitionBase, delay: 0.08 }}
      className="wl-card-hover flex flex-col gap-2.5 rounded-[28px] border border-[#ECECF2] bg-white p-6"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-[#EEEAFE] text-[#5B3FE6]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      </span>
      <span className="text-xl font-bold">{t('landing.features.forecastCard.title')}</span>
      <span className="text-sm leading-[1.55] text-[#6B6B7B]">
        {t('landing.features.forecastCard.description')}
      </span>
      <div className="mt-2 rounded-[20px] border border-[#F0EEF8] bg-[#F7F6FC] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold">{t('landing.features.forecastCard.chartLabel')}</span>
          <span className="flex gap-2.5 text-[11px] text-[#6B6B7B]">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#5B3FE6]" />
              {t('landing.features.forecastCard.legendSales')}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#0E0E1A]" />
              {t('landing.features.forecastCard.legendExpenses')}
            </span>
          </span>
        </div>
        <svg
          viewBox="0 0 320 120"
          width="100%"
          height="120"
          role="img"
          aria-label={t('landing.features.forecastCard.chartAria')}
          className="mt-2 block"
        >
          <line x1="0" y1="30" x2="320" y2="30" stroke="#E6E3F3" strokeDasharray="3 4" />
          <line x1="0" y1="70" x2="320" y2="70" stroke="#E6E3F3" strokeDasharray="3 4" />
          <line x1="0" y1="110" x2="320" y2="110" stroke="#E6E3F3" strokeDasharray="3 4" />
          <m.path
            d="M0 90 C 40 88, 60 70, 90 74 S 140 96, 170 80 S 220 40, 250 42 S 300 22, 320 18"
            fill="none"
            stroke="#5B3FE6"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={revealViewport}
            transition={{ duration: 1.1, ease: EASE }}
          />
          <m.path
            d="M0 70 C 40 66, 60 84, 90 82 S 140 70, 170 76 S 220 86, 250 80 S 300 74, 320 76"
            fill="none"
            stroke="#0E0E1A"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={revealViewport}
            transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
          />
          <line x1="250" y1="14" x2="250" y2="110" stroke="#C9BDFB" strokeDasharray="3 3" />
          <circle cx="250" cy="42" r="5" fill="#5B3FE6" />
          <circle cx="250" cy="80" r="5" fill="#0E0E1A" />
        </svg>
      </div>
    </m.div>
  )
}

function StockCard() {
  const { t } = useTranslation()
  const items = [
    { name: t('landing.features.stockCard.item1'), swatch: '#EEEAFE', count: 24, tone: 'ok' as const },
    { name: t('landing.features.stockCard.item2'), swatch: '#FFF0E0', count: 2, tone: 'low' as const },
    { name: t('landing.features.stockCard.item3'), swatch: '#E6EEFF', count: 41, tone: 'ok' as const },
  ]

  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      variants={fadeUpBlur}
      transition={{ ...transitionBase, delay: 0.16 }}
      className="wl-card-hover col-span-full flex flex-wrap items-center gap-6 rounded-[28px] border border-[#ECECF2] bg-white p-6"
    >
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#EEEAFE] text-[#5B3FE6]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
            <path d="M3 8l9 5 9-5M12 13v8" />
          </svg>
        </span>
        <span className="text-xl font-bold">{t('landing.features.stockCard.title')}</span>
        <span className="max-w-[420px] text-sm leading-[1.55] text-[#6B6B7B]">
          {t('landing.features.stockCard.description')}
        </span>
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 rounded-[20px] border border-[#F0EEF8] bg-[#F7F6FC] p-4">
        <span className="text-xs text-[#6B6B7B]">{t('landing.features.stockCard.stockValue')}</span>
        <span className="text-[26px] font-extrabold tracking-[-0.02em]">
          4 580 000 <span className="text-[13px] font-semibold text-[#6B6B7B]">FCFA</span>
        </span>
        <span className="flex h-2 overflow-hidden rounded-full bg-[#E6E3F3]">
          <m.span
            className="rounded-full"
            style={{ background: 'linear-gradient(90deg, #8C74FF, #3420B8)' }}
            initial={{ width: 0 }}
            whileInView={{ width: '72%' }}
            viewport={revealViewport}
            transition={{ duration: 1, ease: EASE }}
          />
        </span>
        <span className="text-xs text-[#6B6B7B]">{t('landing.features.stockCard.stockValueAboveThreshold')}</span>
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-2.5 rounded-[14px] border border-[#ECECF2] bg-white px-3 py-2.5">
            <span className="size-8 rounded-[10px]" style={{ background: item.swatch }} />
            <span className="flex-1 text-[13px] font-semibold">{item.name}</span>
            <span
              className={
                item.tone === 'low'
                  ? 'rounded-full bg-[#FFF0E0] px-2 py-0.5 text-xs font-bold text-[#8A4B00]'
                  : 'rounded-full bg-[#E3F5EA] px-2 py-0.5 text-xs font-bold text-[#0B6B39]'
              }
            >
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </m.div>
  )
}

export function Features() {
  return (
    <section
      id="fonctionnalites"
      className="mx-auto flex max-w-[1180px] scroll-mt-24 flex-col items-center gap-11 px-5 pt-[120px]"
    >
      <SectionHeading />
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] gap-4.5">
        <SalesChartCard />
        <ForecastChartCard />
        <StockCard />
      </div>
    </section>
  )
}
