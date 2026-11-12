'use client'

import * as React from 'react'
import { Image as ImageIcon, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { ACCEPTED_INPUT_TYPES } from '@/lib/media/compress'

// Fichier d'origine : il est compressé dans le navigateur (512 px, WebP)
// avant l'envoi, une photo de téléphone de plusieurs Mo passe donc.
const MAX_SIZE_BYTES = 25 * 1024 * 1024

interface LogoUploadButtonProps {
  previewUrl: string | null
  onSelect: (file: File) => void
  error: string | null
  /** Bouton « Réessayer » après un échec réseau de l'envoi. */
  onRetry?: () => void
  className?: string
}

/**
 * Bouton « Ajouter votre logo » (bordure pointillée) commun aux rendus
 * ordinateur et mobile de l'étape 2 — validation cliente immédiate (type +
 * 2 Mo) à la sélection ; l'upload réel n'a lieu qu'au clic sur Continuer
 * (voir page onboarding/entreprise).
 */
export function LogoUploadButton({ previewUrl, onSelect, error, onRetry, className }: LogoUploadButtonProps) {
  const { t } = useTranslation()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = React.useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type && !ACCEPTED_INPUT_TYPES.split(',').includes(file.type)) {
      setLocalError(t('onboarding.logoUpload.unsupportedFormat'))
      e.target.value = ''
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(t('onboarding.logoUpload.tooLarge'))
      e.target.value = ''
      return
    }

    setLocalError(null)
    onSelect(file)
  }

  const shownError = localError || error

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3.5 rounded-[18px] border border-dashed border-[#B9B9C8] bg-[#F6F5FB] p-3.5 text-left md:w-auto md:self-start md:rounded-[22px] md:py-3.5 md:pr-5 md:pl-3.5"
      >
        <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EEEAFE] text-[#4B2FD6] md:size-16 md:rounded-[18px]">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (object URL), pas une image distante
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6" strokeWidth={1.8} />
          )}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold text-[#0E0E1A]">
            {previewUrl ? t('onboarding.logoUpload.change') : t('onboarding.logoUpload.add')}
          </span>
          <span className="text-[13px] text-[#6B6B7B]">{t('onboarding.logoUpload.hint')}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_INPUT_TYPES}
        className="hidden"
        onChange={handleChange}
      />
      {shownError ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#A3213A]">
          <span>{shownError}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#E2E2EA] bg-white px-3.5 text-[13px] text-[#0E0E1A]"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t('media.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
