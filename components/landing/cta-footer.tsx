'use client'

import * as React from 'react'
import Link from 'next/link'
import { m } from 'motion/react'
import { toast } from 'sonner'

import { fadeUpBlur, revealViewport, transitionBase } from '@/lib/motion'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

function NewsletterForm() {
  const { t } = useTranslation()
  const [email, setEmail] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('landing.ctaFooter.newsletterInvalidEmail'))
      return
    }
    toast.success(t('landing.ctaFooter.newsletterSuccess'))
    setEmail('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-1.5 rounded-[27px] border border-white/15 bg-white/10 p-1.5"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        {t('landing.ctaFooter.newsletterEmailLabel')}
      </label>
      <input
        id="newsletter-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('landing.ctaFooter.newsletterEmailPlaceholder')}
        className="h-[42px] min-w-0 flex-1 border-0 bg-transparent px-3.5 font-sans text-sm text-white outline-none placeholder:text-[#8E8EC0]"
      />
      <button
        type="submit"
        className="h-[42px] cursor-pointer rounded-full border-0 px-4.5 font-sans text-sm font-bold text-white"
        style={{ background: 'radial-gradient(100% 140% at 20% 0%, #8C74FF 0%, #5B3FE6 50%, #3420B8 100%)' }}
      >
        {t('landing.ctaFooter.newsletterSubscribe')}
      </button>
    </form>
  )
}

export function CtaFooter() {
  const { t } = useTranslation()
  return (
    <div className="relative mt-[140px]">
      <div className="relative z-[2] mx-auto max-w-[1180px] px-5">
        <m.div
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          variants={fadeUpBlur}
          transition={transitionBase}
          className="relative flex flex-col items-center gap-4 overflow-hidden rounded-[34px] p-[clamp(36px,6vw,64px)_24px] text-center text-white"
          style={{
            background: 'radial-gradient(70% 120% at 50% 0%, #7A5CF5 0%, #4B2FD6 45%, #2A1A9E 100%)',
            boxShadow: '0 30px 70px rgba(42,26,158,.4)',
          }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.14) 1.4px, transparent 1.7px)',
              backgroundSize: '18px 18px',
              maskImage: 'radial-gradient(60% 80% at 50% 100%, #000, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(60% 80% at 50% 100%, #000, transparent 75%)',
            }}
          />
          <h2 className="relative m-0 max-w-[640px] text-[clamp(30px,4vw,50px)] font-extrabold leading-[1.06] tracking-[-0.035em]">
            {t('landing.ctaFooter.title')}
          </h2>
          <p className="relative m-0 max-w-[480px] text-base leading-[1.55] text-[#DCDCF7]">
            {t('landing.ctaFooter.subtitle')}
          </p>
          <div className="relative mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="wl-btn-hover flex h-[52px] items-center justify-center rounded-full bg-white px-6.5 text-[15px] font-extrabold text-[#3A20B8]"
              style={{ boxShadow: '0 10px 24px rgba(10,10,60,.25)' }}
            >
              {t('landing.ctaFooter.createAccount')}
            </Link>
            <Link
              href="/login"
              className="wl-btn-hover flex h-[52px] items-center justify-center rounded-full border border-white/35 bg-white/15 px-6 text-[15px] font-bold text-white"
            >
              {t('landing.ctaFooter.alreadyHaveAccount')}
            </Link>
          </div>
        </m.div>
      </div>

      <footer
        className="mt-[-110px] px-5 pb-9 pt-[170px] text-white [&_a]:text-[#B9B9E0] [&_a]:no-underline [&_a]:text-sm hover:[&_a]:text-white"
        style={{ background: 'radial-gradient(60% 80% at 50% 0%, #1A1A6E 0%, #0A0A3A 55%, #06062A 100%)' }}
      >
        <div className="mx-auto flex max-w-[1140px] flex-col gap-10">
          <div className="flex flex-wrap justify-between gap-9">
            <div className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-3.5">
              <span className="flex items-center gap-2.5">
                <span
                  className="flex size-9 items-center justify-center rounded-[11px] text-lg font-extrabold"
                  style={{ background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)' }}
                >
                  W
                </span>
                <span className="text-xl font-extrabold">Waelly</span>
              </span>
              <span className="text-sm leading-[1.55] text-[#B9B9E0]">
                {t('landing.ctaFooter.newsletterTagline')}
              </span>
              <NewsletterForm />
            </div>

            <div className="grid flex-[2_1_420px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-6">
              <div className="flex flex-col gap-2">
                <span className="mb-1 text-sm font-bold">{t('landing.ctaFooter.productSection')}</span>
                <a href="#fonctionnalites" className="py-1">{t('landing.navbar.features')}</a>
                <a href="#tarifs" className="py-1">{t('landing.navbar.pricing')}</a>
                <a href="#faq" className="py-1">{t('landing.navbar.faq')}</a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="mb-1 text-sm font-bold">{t('landing.ctaFooter.accountSection')}</span>
                <Link href="/login" className="py-1 text-sm text-[#B9B9E0] no-underline hover:text-white">
                  {t('landing.ctaFooter.login')}
                </Link>
                <Link href="/signup" className="py-1 text-sm text-[#B9B9E0] no-underline hover:text-white">
                  {t('landing.ctaFooter.createAccountLink')}
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="mb-1 text-sm font-bold">{t('landing.ctaFooter.legalSection')}</span>
                <a href="#" className="py-1">{t('landing.ctaFooter.legalNotice')}</a>
                <a href="#" className="py-1">{t('landing.ctaFooter.privacy')}</a>
                <a href="#" className="py-1">{t('landing.ctaFooter.contact')}</a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5.5">
            <span className="text-[13px] text-[#8E8EC0]">{t('landing.ctaFooter.copyright')}</span>
            <div className="flex gap-2">
              <a
                href="#"
                aria-label="Facebook"
                className="flex size-[38px] items-center justify-center rounded-full bg-white/10 text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M14 8h3V4h-3c-2.8 0-4 1.7-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="flex size-[38px] items-center justify-center rounded-full bg-white/10 text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="WhatsApp"
                className="flex size-[38px] items-center justify-center rounded-full bg-white/10 text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" />
                  <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
