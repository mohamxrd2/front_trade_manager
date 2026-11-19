'use client'

import * as React from 'react'
import { Loader2, ScanLine, Sparkles, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { primeScanSound } from '@/lib/barcode/camera'
import { BarcodeScanner } from './barcode-scanner'

export interface BarcodeFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  label?: string
  /** Libellé lu par les lecteurs d'écran quand le libellé n'est pas affiché (ligne de variante). */
  ariaLabel?: string
  error?: string | null
  /** « Générer » : absent → pas de bouton. */
  onGenerate?: () => void
  generating?: boolean
  /** Formulaire de création : le code sera généré à l'enregistrement (le bouton devient « Annuler »). */
  pendingGenerate?: boolean
  onCancelGenerate?: () => void
  /** Ligne de variante : champ plus bas, sans libellé ni aide visibles. */
  compact?: boolean
  inputClassName?: string
}

/**
 * Champ « Code-barre » : saisie (ou douchette, qui tape dans le champ),
 * bouton scanner (caméra, une fois) et bouton « Générer » (EAN-13 interne).
 */
export function BarcodeField({
  id,
  value,
  onChange,
  onBlur,
  label,
  ariaLabel,
  error,
  onGenerate,
  generating = false,
  pendingGenerate = false,
  onCancelGenerate,
  compact = false,
  inputClassName,
}: BarcodeFieldProps) {
  const { t } = useTranslation()
  const [scannerOpen, setScannerOpen] = React.useState(false)
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const height = compact ? 'h-10' : 'h-[52px]'
  const describedBy = [error ? errorId : null, !compact || pendingGenerate ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      {!compact ? (
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {label ?? t('barcode.field.label')}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={pendingGenerate ? '' : value}
          disabled={pendingGenerate}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          // Une douchette tape le code puis Entrée : l'Entrée ne doit pas envoyer le formulaire.
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault()
          }}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('barcode.field.placeholder')}
          aria-label={compact ? (ariaLabel ?? label ?? t('barcode.field.label')) : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            height,
            'min-w-0 flex-1 rounded-field border border-line-strong bg-surface px-3.5 font-mono text-base tracking-wide text-ink outline-none focus:border-brand-500 disabled:bg-surface-soft md:text-[15px]',
            error && 'border-danger-strong',
            inputClassName
          )}
        />
        <button
          type="button"
          onClick={() => {
            primeScanSound()
            setScannerOpen(true)
          }}
          disabled={pendingGenerate}
          aria-label={t('barcode.field.scan')}
          title={t('barcode.field.scan')}
          className={cn(
            height,
            'flex aspect-square shrink-0 items-center justify-center rounded-field border border-line-strong bg-surface text-ink-2 transition-colors hover:bg-surface-soft disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
          )}
        >
          <ScanLine className="size-5" aria-hidden="true" />
        </button>
        {pendingGenerate ? (
          <button
            type="button"
            onClick={onCancelGenerate}
            className={cn(height, 'inline-flex shrink-0 items-center gap-1.5 rounded-field px-3 text-sm font-bold text-ink-2 hover:bg-surface-soft')}
          >
            <X className="size-4" aria-hidden="true" />
            {t('barcode.field.cancelGenerate')}
          </button>
        ) : onGenerate && !value.trim() ? (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            aria-label={t('barcode.field.generateAria')}
            className={cn(
              height,
              'inline-flex shrink-0 items-center gap-1.5 rounded-field border border-brand-200 bg-brand-50 px-3 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
            )}
          >
            {generating ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
            {t('barcode.field.generate')}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-danger-strong">
          {error}
        </p>
      ) : null}
      {pendingGenerate ? (
        <p id={hintId} className="text-xs font-semibold text-brand-700">
          {t('barcode.field.willGenerate')}
        </p>
      ) : !compact ? (
        <p id={hintId} className="text-xs text-subtle">
          {t('barcode.field.hint')}
        </p>
      ) : null}

      <BarcodeScanner open={scannerOpen} onOpenChange={setScannerOpen} mode="once" onDetected={(code) => onChange(code)} />
    </div>
  )
}
