'use client'

import { cn } from '@/lib/utils'
import { passwordScore } from '@/lib/password-rules'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

/** Jauge de force du mot de passe (4 barres), commune à l'inscription et à « Mot de passe oublié ». */
export function PasswordStrengthGauge({ password }: { password: string }) {
  const { t } = useTranslation()
  const score = passwordScore(password)
  const scoreLabels: Record<number, string> = {
    0: t('auth.signup.scoreTooWeak'),
    1: t('auth.signup.scoreTooWeak'),
    2: t('auth.signup.scoreMedium'),
    3: t('auth.signup.scoreGood'),
    4: t('auth.signup.scoreExcellent'),
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-[5px] rounded-[3px]', i < score ? 'bg-[#5B3FE6]' : 'bg-[#E2E2EA]')} />
        ))}
      </div>
      <p className="text-xs text-[#4B4B5C]" aria-live="polite">
        {scoreLabels[score]} · {t('auth.signup.passwordHint')}
      </p>
    </div>
  )
}
