'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'motion/react'

import { PRICING_PLANS, YEARLY_DISCOUNT_LABEL, periodSuffix, type BillingPeriod } from '@/lib/pricing'
import { EASE, fadeUp, revealViewport, transitionBase } from '@/lib/motion'
import { cn } from '@/lib/utils'

function BillingToggle({ period, onChange }: { period: BillingPeriod; onChange: (p: BillingPeriod) => void }) {
  const pillBase = 'flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-0 px-3.5 font-sans text-sm font-semibold'

  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={revealViewport}
      variants={fadeUp}
      transition={transitionBase}
      role="group"
      aria-label="Période de facturation"
      className="flex items-center gap-3 text-sm font-semibold"
    >
      <button
        type="button"
        onClick={() => onChange('monthly')}
        aria-pressed={period === 'monthly'}
        className={cn(
          pillBase,
          period === 'monthly' ? 'bg-white text-[#0E0E1A] shadow-[0_2px_8px_rgba(17,17,80,.1)]' : 'bg-transparent text-[#6B6B7B]'
        )}
      >
        Mensuel
      </button>
      <button
        type="button"
        onClick={() => onChange(period === 'monthly' ? 'yearly' : 'monthly')}
        aria-label="Basculer mensuel / annuel"
        className="relative flex h-[30px] w-[52px] items-center rounded-full border-0 bg-[#5B3FE6] p-[3px]"
      >
        <m.span
          animate={{ x: period === 'yearly' ? 22 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="size-6 rounded-full bg-white"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}
        />
      </button>
      <button
        type="button"
        onClick={() => onChange('yearly')}
        aria-pressed={period === 'yearly'}
        className={cn(
          pillBase,
          period === 'yearly' ? 'bg-white text-[#0E0E1A] shadow-[0_2px_8px_rgba(17,17,80,.1)]' : 'bg-transparent text-[#6B6B7B]'
        )}
      >
        Annuel
        <span className="rounded-full bg-[#E3F5EA] px-2 py-0.5 text-[11px] font-extrabold text-[#0B6B39]">
          {YEARLY_DISCOUNT_LABEL}
        </span>
      </button>
    </m.div>
  )
}

export function Pricing() {
  const [period, setPeriod] = React.useState<BillingPeriod>('monthly')

  return (
    <section id="tarifs" className="mx-auto flex max-w-[1180px] scroll-mt-24 flex-col items-center gap-7 px-5 pt-[120px]">
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex flex-col items-center gap-3 text-center"
      >
        <h2 className="m-0 text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
          Un prix simple, en FCFA
        </h2>
        <p className="m-0 text-base text-[#6B6B7B]">Choisissez l&apos;offre qui suit le rythme de votre commerce.</p>
      </m.div>

      <BillingToggle period={period} onChange={setPeriod} />

      <div className="grid w-full max-w-[980px] grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-stretch gap-4.5">
        {PRICING_PLANS.map((plan, i) => (
          <m.div
            key={plan.id}
            initial="hidden"
            whileInView="visible"
            viewport={revealViewport}
            variants={fadeUp}
            transition={{ ...transitionBase, delay: i * 0.08 }}
            className={cn(
              'wl-card-hover flex flex-col gap-2.5 rounded-[28px] p-7',
              plan.featured ? 'text-white shadow-[0_26px_56px_rgba(58,32,184,.35)]' : 'border border-[#ECECF2] bg-white shadow-[0_4px_18px_rgba(17,17,80,.05)]'
            )}
            style={
              plan.featured
                ? { background: 'radial-gradient(120% 120% at 100% 100%, #5B3FE6 0%, #3A20B8 45%, #1717A0 100%)' }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-extrabold">{plan.name}</span>
              {plan.featured ? (
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white">
                  Le plus choisi
                </span>
              ) : null}
            </div>
            <span className={cn('text-[13px]', plan.featured ? 'text-[#DCDCF7]' : 'text-[#6B6B7B]')}>{plan.tagline}</span>
            <span className="flex items-baseline gap-1.5 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <m.span
                  key={period}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="text-[38px] font-extrabold tracking-[-0.03em]"
                >
                  {plan.price[period]}
                </m.span>
              </AnimatePresence>
              <span className={cn('text-[13px]', plan.featured ? 'text-[#DCDCF7]' : 'text-[#6B6B7B]')}>
                {periodSuffix(period)}
              </span>
            </span>
            <ul className="m-0 mt-1.5 flex flex-1 list-none flex-col gap-2.5 p-0">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      'flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-extrabold',
                      plan.featured ? 'bg-white/20 text-white' : 'bg-[#EEEAFE] text-[#5B3FE6]'
                    )}
                  >
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className={cn(
                'wl-btn-hover mt-3.5 flex h-[50px] items-center justify-center rounded-full text-[15px] font-bold',
                plan.featured ? 'bg-white text-[#3A20B8]' : 'text-white'
              )}
              style={
                plan.featured
                  ? undefined
                  : { background: 'radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)' }
              }
            >
              {plan.cta}
            </Link>
          </m.div>
        ))}
      </div>
    </section>
  )
}
