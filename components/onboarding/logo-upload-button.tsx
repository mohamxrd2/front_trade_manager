'use client'

import * as React from 'react'
import { Image as ImageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const MAX_SIZE_BYTES = 2 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg']

interface LogoUploadButtonProps {
  previewUrl: string | null
  onSelect: (file: File) => void
  error: string | null
  className?: string
}

/**
 * Bouton « Ajouter votre logo » (bordure pointillée) commun aux rendus
 * ordinateur et mobile de l'étape 2 — validation cliente immédiate (type +
 * 2 Mo) à la sélection ; l'upload réel n'a lieu qu'au clic sur Continuer
 * (voir page onboarding/entreprise).
 */
export function LogoUploadButton({ previewUrl, onSelect, error, className }: LogoUploadButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = React.useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError('Format non supporté (PNG ou JPG uniquement).')
      e.target.value = ''
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError('Image trop lourde (2 Mo max)')
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
            {previewUrl ? 'Changer le logo' : 'Ajouter votre logo'}
          </span>
          <span className="text-[13px] text-[#6B6B7B]">PNG ou JPG, carré de préférence</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleChange}
      />
      {shownError ? <p className="text-xs font-semibold text-[#A3213A]">{shownError}</p> : null}
    </div>
  )
}
