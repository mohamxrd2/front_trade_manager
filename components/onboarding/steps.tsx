'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/* ============================= Ordinateur : colonne de verre ============================= */

interface StepsAsideProps {
  current: 2 | 3
}

export function StepsAside({ current }: StepsAsideProps) {
  const { t } = useTranslation()
  return (
    <aside
      className="flex flex-[1_1_280px] flex-col gap-[26px] rounded-[28px] p-[26px]"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.44))',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.88)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.95), 0 20px 50px rgba(17,17,80,0.10)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-[18px] font-extrabold text-white"
          style={{ background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)' }}
        >
          W
        </span>
        <span className="text-[20px] font-extrabold text-[#0E0E1A]">Waelly</span>
      </div>

      <ol aria-label={t('onboarding.progress.ariaLabel')} className="flex flex-col gap-1.5">
        {/* Étape 1 — toujours terminée pour arriver ici (inscription + code vérifié) */}
        <li className="flex items-center gap-3 rounded-2xl bg-[#E3F5EA] p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0B8A43] text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-bold text-[#0B6B39]">{t('onboarding.progress.step1Title')}</span>
            <span className="text-xs text-[#0B6B39]">{t('onboarding.progress.step1Subtitle')}</span>
          </span>
        </li>

        {/* Étape 2 — terminée (cliquable) si on est à l'étape 3, active sinon */}
        {current === 3 ? (
          <li>
            <Link
              href="/onboarding/entreprise"
              className="flex items-center gap-3 rounded-2xl bg-[#E3F5EA] p-3 transition-opacity hover:opacity-90"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0B8A43] text-white">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold text-[#0B6B39]">{t('onboarding.progress.step2Title')}</span>
                <span className="text-xs text-[#0B6B39]">{t('onboarding.progress.step2Subtitle')}</span>
              </span>
            </Link>
          </li>
        ) : (
          <li
            aria-current="step"
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{
              background: 'linear-gradient(180deg, rgba(106,76,240,0.16), rgba(106,76,240,0.07))',
              boxShadow: 'inset 0 0 0 1px rgba(106,76,240,0.14)',
            }}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#5B3FE6] text-sm font-extrabold text-white">
              2
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-[#0E0E1A]">{t('onboarding.progress.step2Title')}</span>
              <span className="text-xs text-[#6B6B7B]">{t('onboarding.progress.step2Subtitle')}</span>
            </span>
          </li>
        )}

        {/* Étape 3 — active si current===3, à venir sinon */}
        {current === 3 ? (
          <li
            aria-current="step"
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{
              background: 'linear-gradient(180deg, rgba(106,76,240,0.16), rgba(106,76,240,0.07))',
              boxShadow: 'inset 0 0 0 1px rgba(106,76,240,0.14)',
            }}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#5B3FE6] text-sm font-extrabold text-white">
              3
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-[#0E0E1A]">{t('onboarding.progress.step3Title')}</span>
              <span className="text-xs text-[#6B6B7B]">{t('onboarding.progress.step3Subtitle')}</span>
            </span>
          </li>
        ) : (
          <li className="flex items-center gap-3 rounded-2xl p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#EDEDF2] text-sm font-extrabold text-[#4B4B5C]">
              3
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-[#0E0E1A]">{t('onboarding.progress.step3Title')}</span>
              <span className="text-xs text-[#6B6B7B]">{t('onboarding.progress.step3Subtitle')}</span>
            </span>
          </li>
        )}
      </ol>
    </aside>
  )
}

/* ============================= Mobile : barre à 3 segments ============================= */

interface StepsBarProps {
  current: 2 | 3
  className?: string
}

export function StepsBar({ current, className }: StepsBarProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-1.5', className)} aria-hidden="true">
      {[1, 2, 3].map((segment) => (
        <span
          key={segment}
          className={cn('h-[5px] rounded-[3px]', segment <= current ? 'bg-[#5B3FE6]' : 'bg-[#E2E2EA]')}
        />
      ))}
    </div>
  )
}
