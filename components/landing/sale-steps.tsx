'use client'

import { m } from 'motion/react'

import { fadeUpBlur, revealViewport, transitionBase } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

function useSteps() {
  const { t } = useTranslation()
  return [
    { title: t('landing.saleSteps.step1Title'), body: t('landing.saleSteps.step1Body') },
    { title: t('landing.saleSteps.step2Title'), body: t('landing.saleSteps.step2Body') },
    { title: t('landing.saleSteps.step3Title'), body: t('landing.saleSteps.step3Body') },
  ]
}

function SalePhoneMock() {
  const { t } = useTranslation()
  return (
    <div aria-hidden="true" className="flex flex-1 min-w-[300px] justify-center">
      <div
        className="w-[280px] rounded-t-[44px] bg-[#0E0E1A] p-2.5 pb-0 mb-[clamp(-56px,-5vw,-28px)]"
        style={{ boxShadow: '0 30px 60px rgba(20,10,90,.3)' }}
      >
        <div className="flex h-full flex-col gap-3 rounded-t-[35px] bg-white px-4 pt-11">
          <span className="text-center text-sm font-bold">{t('landing.saleSteps.mockup.newSale')}</span>
          <div className="flex items-center gap-2.5 rounded-2xl border border-[#ECECF2] p-3">
            <span className="size-9 rounded-[10px] bg-[#EEEAFE]" />
            <span className="flex flex-1 flex-col">
              <span className="text-xs font-bold">{t('landing.saleSteps.mockup.articleName')}</span>
              <span className="text-[11px] text-[#6B6B7B]">{t('landing.saleSteps.mockup.articleVariant')}</span>
            </span>
            <span className="text-xs font-bold">25 000</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-[#F7F6FC] px-3 py-2.5">
            <span className="text-xs text-[#6B6B7B]">{t('landing.saleSteps.mockup.quantity')}</span>
            <span className="flex items-center gap-2.5 font-bold">
              <span className="flex size-7 items-center justify-center rounded-full border border-[#E2E2EA]">−</span>
              2
              <span className="flex size-7 items-center justify-center rounded-full bg-[#5B3FE6] text-white">+</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#E2E2EA] px-2.5 py-1.5 text-[11px] font-semibold">{t('landing.saleSteps.mockup.cashMethod')}</span>
            <span className="rounded-full bg-[#0E0E1A] px-2.5 py-1.5 text-[11px] font-semibold text-white">{t('landing.saleSteps.mockup.mobileMoneyMethod')}</span>
            <span className="rounded-full border border-[#E2E2EA] px-2.5 py-1.5 text-[11px] font-semibold">{t('landing.saleSteps.mockup.cardMethod')}</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-dashed border-[#E2E2EA] pt-2">
            <span className="text-xs text-[#6B6B7B]">{t('landing.saleSteps.mockup.total')}</span>
            <span className="text-[22px] font-extrabold">
              50 000 <span className="text-[11px] text-[#6B6B7B]">FCFA</span>
            </span>
          </div>
          <span
            className="flex h-[46px] items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: 'radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)' }}
          >
            {t('landing.saleSteps.mockup.validate')}
          </span>
          <span className="wl-pin mt-1.5 self-center rounded-full bg-[#E3F5EA] px-3 py-1.5 text-[11px] font-bold text-[#0B6B39]">
            ✓ {t('landing.saleSteps.mockup.stockUpdated')}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SaleSteps() {
  const { t } = useTranslation()
  const steps = useSteps()
  return (
    <section id="vente" className="mx-auto max-w-[1180px] px-5 pt-[120px]">
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUpBlur}
        transition={transitionBase}
        className="relative flex flex-wrap items-center gap-10 overflow-hidden rounded-[34px] p-[clamp(28px,5vw,56px)]"
        style={{
          background:
            'radial-gradient(60% 80% at 100% 100%, rgba(91,63,230,.28), rgba(91,63,230,0) 70%), linear-gradient(180deg, #F6F4FF, #ECE7FF)',
        }}
      >
        <div className="flex min-w-[320px] flex-[1_1_380px] flex-col gap-5.5">
          <h2 className="m-0 text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
            {t('landing.saleSteps.title')}
          </h2>
          <p className="m-0 max-w-[440px] text-base leading-[1.55] text-[#4B4B5C]">
            {t('landing.saleSteps.subtitle')}
          </p>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-3.5">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white font-extrabold text-[#5B3FE6]"
                  style={{ boxShadow: '0 4px 12px rgba(91,63,230,.12)' }}
                >
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-bold">{step.title}</span>
                  <span className="text-sm leading-[1.5] text-[#6B6B7B]">{step.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <SalePhoneMock />
      </m.div>
    </section>
  )
}
