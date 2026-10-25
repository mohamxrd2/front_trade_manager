'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  id: string
  error?: string
  /** Élément affiché à droite du label, sur la même ligne (ex. "Mot de passe oublié ?"). */
  labelRight?: React.ReactNode
}

/**
 * Champ mot de passe commun aux 3 pages d'auth — même style qu'AuthInput,
 * avec un bouton œil 44×44 (right:4, top:4) pour basculer la visibilité.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, id, error, labelRight, className, ...props },
  ref
) {
  const { t } = useTranslation()
  const [show, setShow] = React.useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-semibold text-[#0E0E1A]">
          {label}
        </label>
        {labelRight}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={show ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'h-[52px] w-full rounded-[14px] border border-[#E2E2EA] bg-white py-0 pl-4 pr-[52px] text-[16px] text-[#0E0E1A] outline-none transition-colors placeholder:text-[#6B6B7B] md:rounded-2xl',
            'focus:border-2 focus:border-[#5B3FE6] focus:pl-[15px] focus:ring-4 focus:ring-[rgba(91,63,230,0.15)]',
            error &&
              'border-2 border-[#D92D20] pl-[15px] focus:border-[#D92D20] focus:ring-[rgba(217,45,32,0.12)]',
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
          className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-[#6B6B7B] transition-colors hover:text-[#0E0E1A]"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-[#A3213A]">
          {error}
        </p>
      ) : null}
    </div>
  )
})
