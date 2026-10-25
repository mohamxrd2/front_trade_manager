'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface OtpInputProps {
  length?: number
  /** Entièrement contrôlé par le parent : le parent remet '' pour vider + refocus (ex. code faux). */
  value: string
  onChange: (value: string) => void
  /** Appelé dès que les `length` chiffres sont saisis (collage inclus) — déclenche la soumission auto. */
  onComplete?: (value: string) => void
  error?: boolean
  disabled?: boolean
  legend: string
  legendClassName?: string
  boxClassName?: string
  containerClassName?: string
}

/**
 * Grille de cases de code à usage unique, commune à /verify (ordinateur +
 * mobile) — une seule case par chiffre, avance automatique, retour arrière
 * intelligent, collage multi-chiffres, navigation flèches.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  disabled,
  legend,
  legendClassName,
  boxClassName,
  containerClassName,
}: OtpInputProps) {
  const { t } = useTranslation()
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([])
  const prevValueRef = React.useRef(value)

  const digits = React.useMemo(() => {
    const arr = value.split('').slice(0, length)
    while (arr.length < length) arr.push('')
    return arr
  }, [value, length])

  React.useEffect(() => {
    // Code faux détecté par le parent : il vide `value` depuis l'extérieur —
    // on refocus la première case dès que ça se produit.
    if (prevValueRef.current !== '' && value === '') {
      inputRefs.current[0]?.focus()
    }
    prevValueRef.current = value
  }, [value])

  const setDigitAt = (index: number, char: string) => {
    const next = digits.slice()
    next[index] = char
    const joined = next.join('')
    onChange(joined)
    if (joined.length === length && next.every((d) => d !== '')) {
      onComplete?.(joined)
    }
  }

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/[^0-9]/g, '').slice(-1)
    setDigitAt(index, digit)
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        setDigitAt(index, '')
      } else if (index > 0) {
        e.preventDefault()
        setDigitAt(index - 1, '')
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
    const focusIndex = Math.min(pasted.length, length - 1)
    inputRefs.current[focusIndex]?.focus()
    if (pasted.length === length) onComplete?.(pasted)
  }

  return (
    <fieldset disabled={disabled} className="m-0 border-0 p-0">
      <legend className={legendClassName}>{legend}</legend>
      <div className={cn('flex', containerClassName)}>
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={t('auth.otp.digitLabel', { n: i + 1 })}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'border text-center font-bold text-[#0E0E1A] outline-none transition-colors',
              error
                ? 'border-2 border-[#D92D20] motion-safe:animate-[otp-shake_0.3s_ease-in-out]'
                : 'border-[#E2E2EA] focus:border-2 focus:border-[#5B3FE6]',
              boxClassName
            )}
          />
        ))}
      </div>
    </fieldset>
  )
}
