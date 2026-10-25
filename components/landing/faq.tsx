'use client'

import * as React from 'react'
import { AnimatePresence, m } from 'motion/react'

import { EASE, fadeUp, revealViewport, transitionBase } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

type TabId = 'general' | 'factures' | 'compte'

const TAB_IDS: TabId[] = ['general', 'factures', 'compte']

function useFaqData(t: ReturnType<typeof useTranslation>['t']): Record<TabId, { q: string; a: string }[]> {
  const section = (id: TabId) =>
    [1, 2, 3, 4].map((i) => ({ q: t(`landing.faq.${id}.q${i}`), a: t(`landing.faq.${id}.a${i}`) }))
  return { general: section('general'), factures: section('factures'), compte: section('compte') }
}

export function Faq() {
  const { t } = useTranslation()
  const [tab, setTab] = React.useState<TabId>('general')
  const [openIndex, setOpenIndex] = React.useState(0)

  const faqData = useFaqData(t)
  const faqs = faqData[tab]

  return (
    <section id="faq" className="mx-auto flex max-w-[820px] scroll-mt-24 flex-col items-center gap-6 px-5 pt-[120px]">
      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        className="flex flex-col items-center gap-3 text-center"
      >
        <h2 className="m-0 text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
          {t('landing.faq.titleLine1')}
          <br />
          {t('landing.faq.titleLine2')}
        </h2>
        <p className="m-0 text-base text-[#6B6B7B]">{t('landing.faq.subtitle')}</p>
      </m.div>

      <m.div
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={fadeUp}
        transition={transitionBase}
        role="tablist"
        aria-label={t('landing.faq.tabsAria')}
        className="flex flex-wrap justify-center gap-1 rounded-[26px] bg-[#F1EFFA] p-1"
      >
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setOpenIndex(0)
            }}
            className={cn(
              'min-h-[42px] cursor-pointer rounded-full border-0 px-5 font-sans text-sm font-semibold',
              tab === id ? 'bg-[#5B3FE6] text-white font-bold' : 'bg-transparent text-[#4B4B5C]'
            )}
          >
            {t(`landing.faq.tabs.${id}`)}
          </button>
        ))}
      </m.div>

      <div className="flex w-full flex-col gap-2.5">
        {faqs.map((item, i) => {
          const open = i === openIndex
          return (
            <div
              key={item.q}
              className={cn(
                'overflow-hidden rounded-[20px] border transition-colors duration-250',
                open ? 'border-[#DCD4FF] bg-[#F4F1FF]' : 'border-[#ECECF2] bg-white'
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(open ? -1 : i)}
                aria-expanded={open}
                className="flex min-h-[60px] w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-5 text-left font-sans text-[15px] font-bold text-[#0E0E1A]"
              >
                {item.q}
                <span
                  className={cn(
                    'flex size-[30px] shrink-0 items-center justify-center rounded-full text-lg font-semibold transition-transform duration-250',
                    open ? 'rotate-45 bg-[#5B3FE6] text-white' : 'bg-[#F3F3F7] text-[#0E0E1A]'
                  )}
                >
                  +
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open ? (
                  <m.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <p className="m-0 px-5 pb-4.5 text-sm leading-[1.6] text-[#4B4B5C]">{item.a}</p>
                  </m.div>
                ) : null}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
