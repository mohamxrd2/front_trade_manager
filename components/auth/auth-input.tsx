import * as React from 'react'

import { cn } from '@/lib/utils'

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  id: string
  error?: string
}

/**
 * Champ texte commun aux 3 pages d'auth (design/DESIGN.md § Connexion).
 * h-52, rayon 16 ordinateur / 14 mobile, 16px (zoom iOS), focus ring brand,
 * erreur rouge avec message annoncé (aria-describedby).
 */
export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { label, id, error, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-[#0E0E1A]">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-[52px] rounded-[14px] border border-[#E2E2EA] bg-white px-4 text-[16px] text-[#0E0E1A] outline-none transition-colors placeholder:text-[#6B6B7B] md:rounded-2xl',
          'focus:border-2 focus:border-[#5B3FE6] focus:px-[15px] focus:ring-4 focus:ring-[rgba(91,63,230,0.15)]',
          error &&
            'border-2 border-[#D92D20] px-[15px] focus:border-[#D92D20] focus:ring-[rgba(217,45,32,0.12)]',
          className
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-[#A3213A]">
          {error}
        </p>
      ) : null}
    </div>
  )
})
