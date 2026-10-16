'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ============================= Champs texte / select ============================= */

interface OnboardingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  id: string
  error?: string
  /** Suffixe discret dans le label, ex. "(facultatif)". */
  optionalHint?: string
}

export const OnboardingInput = React.forwardRef<HTMLInputElement, OnboardingInputProps>(function OnboardingInput(
  { label, id, error, optionalHint, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-[#0E0E1A]">
        {label}
        {optionalHint ? <span className="font-medium text-[#6B6B7B]"> {optionalHint}</span> : null}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-[52px] rounded-[14px] border border-[#E2E2EA] bg-white px-4 text-[16px] text-[#0E0E1A] outline-none transition-colors placeholder:text-[#6B6B7B] md:h-[50px] md:text-[15px]',
          'focus:border-2 focus:border-[#5B3FE6] focus:px-[15px] focus:ring-4 focus:ring-[rgba(91,63,230,0.15)]',
          error && 'border-2 border-[#D92D20] px-[15px] focus:border-[#D92D20]',
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

interface OnboardingSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  id: string
  error?: string
  options: string[]
}

export const OnboardingSelect = React.forwardRef<HTMLSelectElement, OnboardingSelectProps>(function OnboardingSelect(
  { label, id, error, options, className, ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold text-[#0E0E1A]">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-[52px] rounded-[14px] border border-[#E2E2EA] bg-white px-4 text-[16px] text-[#0E0E1A] outline-none transition-colors md:h-[50px] md:text-[15px]',
          'focus:border-2 focus:border-[#5B3FE6] focus:px-[15px] focus:ring-4 focus:ring-[rgba(91,63,230,0.15)]',
          error && 'border-2 border-[#D92D20] px-[15px] focus:border-[#D92D20]',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-semibold text-[#A3213A]">
          {error}
        </p>
      ) : null}
    </div>
  )
})

/* ============================= IBAN : formatage + validation ============================= */

/** Groupes de 4 caractères, majuscules, espaces retirés avant formatage. */
export function formatIban(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return (cleaned.match(/.{1,4}/g) ?? []).join(' ')
}

/** Vide = valide (champ facultatif). Sinon : préfixe pays (2 lettres) + 2 chiffres de contrôle + 10 à 30 alphanumériques. */
export function isValidIbanFormat(raw: string): boolean {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!cleaned) return true
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(cleaned)
}

interface IbanInputProps extends Omit<OnboardingInputProps, 'value' | 'onChange'> {
  value: string | undefined
  onChange: (value: string) => void
}

export function IbanInput({ value, onChange, ...props }: IbanInputProps) {
  return (
    <OnboardingInput
      {...props}
      value={value ?? ''}
      onChange={(e) => onChange(formatIban(e.target.value))}
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
    />
  )
}

/* ============================= Secteur d'activité (puces) ============================= */

export const SECTOR_OPTIONS = [
  'Mode & textile',
  'Alimentation',
  'Cosmétique',
  'Électronique',
  'Restauration',
  'Services',
  'Autre',
]

interface SectorPillsProps {
  value: string
  onChange: (value: string) => void
  /** Puce choisie : encre (ordinateur) ou violet (mobile) — même liste, rendu différent par breakpoint. */
  variant: 'ink' | 'violet'
  className?: string
}

export function SectorPills({ value, onChange, variant, className }: SectorPillsProps) {
  return (
    <div role="group" aria-label="Secteur d'activité" className={cn('flex flex-wrap gap-2', className)}>
      {SECTOR_OPTIONS.map((sector) => {
        const active = value === sector
        return (
          <button
            key={sector}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(sector)}
            className={cn(
              'min-h-11 rounded-full px-[18px] text-sm font-semibold transition-colors',
              active
                ? variant === 'ink'
                  ? 'bg-[#0E0E1A] text-white'
                  : 'bg-[#5B3FE6] text-white'
                : 'border border-[#E2E2EA] bg-white text-[#3F3F50]'
            )}
          >
            {sector}
          </button>
        )
      })}
    </div>
  )
}

/* ============================= Seuil de stock faible (stepper) ============================= */

interface StockThresholdStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function StockThresholdStepper({ value, onChange, min = 0, max = 100 }: StockThresholdStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Diminuer le seuil"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-[42px] shrink-0 items-center justify-center rounded-full border border-[#E2E2EA] bg-white text-[#0E0E1A]"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-14 text-center text-lg font-bold text-[#0E0E1A]" aria-live="polite">
        {value}%
      </span>
      <button
        type="button"
        aria-label="Augmenter le seuil"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-[#5B3FE6] text-white"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
