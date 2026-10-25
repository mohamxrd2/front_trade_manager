'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

const STEP_KEYS = ['auth.steps.step1', 'auth.steps.step2', 'auth.steps.step3']

interface AuthStepsProps {
  current: 1 | 2 | 3
  className?: string
}

/**
 * Liste d'étapes du panneau visuel de /signup (ordinateur) —
 * design/maquettes/ordinateur/Web-Inscription.dc.html. L'étape active a un
 * fond/bordure plus marqués et une pastille blanche pleine ; les étapes
 * inactives restent très translucides.
 */
export function AuthSteps({ current, className }: AuthStepsProps) {
  const { t } = useTranslation()
  return (
    <ol className={cn('flex max-w-[460px] flex-col gap-3', className)}>
      {STEP_KEYS.map((key, i) => {
        const n = i + 1
        const active = n === current
        return (
          <li
            key={key}
            className={cn(
              'flex items-center gap-3 rounded-[20px] px-4 py-3.5',
              active ? 'border border-white/40 bg-white/22' : 'bg-white/12'
            )}
          >
            <span
              className={cn(
                'flex size-[34px] shrink-0 items-center justify-center rounded-full text-sm font-bold',
                active ? 'bg-white text-[#3A20B8]' : 'bg-white/25 text-white'
              )}
            >
              {n}
            </span>
            <span className="text-[15px] font-semibold text-white">{t(key)}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Variante compacte (3 pastilles 28×28 reliées par un trait) — en-tête
 * mobile de /signup, aucune maquette dédiée (famille visuelle de la
 * Connexion mobile).
 */
export function AuthStepsCompact({ current, className }: AuthStepsProps) {
  const { t } = useTranslation()
  return (
    <ol className={cn('flex items-center', className)} aria-label={t('auth.steps.aria')}>
      {STEP_KEYS.map((key, i) => {
        const n = i + 1
        const active = n === current
        return (
          <li key={key} className="flex items-center">
            <span
              aria-current={active ? 'step' : undefined}
              aria-label={t(key)}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                active ? 'bg-white text-[#3A20B8]' : 'bg-white/25 text-white'
              )}
            >
              {n}
            </span>
            {n < STEP_KEYS.length ? <span className="h-px w-6 bg-white/30" aria-hidden="true" /> : null}
          </li>
        )
      })}
    </ol>
  )
}
