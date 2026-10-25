'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Building2, Mail, Image as ImageIcon, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useCompanyOnboarding, completeOnboarding, type MissingField } from '@/hooks/useCompanyOnboarding'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { Button, Card } from '@/components/waelly'

/**
 * Entreprise incomplète — s'affiche (via BillingLayout) quand l'utilisateur
 * tente d'accéder à /invoices sans avoir renseigné logo + email entreprise
 * (seules conditions requises par l'API, voir Company::getIsInvoiceReadyAttribute
 * côté backend). Pas de maquette dédiée : restylée dans le même langage
 * visuel que le reste de l'app (Card/Button Waelly, champ photo en
 * pointillés comme sur /products/new) plutôt que l'ancien style shadcn
 * vert, en gardant exactement la même logique (hooks/complétion).
 */
export default function CompanyOnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { status, isLoading: isLoadingStatus, refresh } = useCompanyOnboarding()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoadingStatus && status && !status.needs_onboarding) {
      router.replace('/invoices')
    }
  }, [isLoadingStatus, status, router])

  const isMissing = (field: MissingField) => status?.missing_fields.includes(field) ?? false
  const needsLogo = isMissing('logo')
  const needsEmail = isMissing('email')

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('onboarding.companyGate.logoTooLarge'))
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('onboarding.companyGate.logoMustBeImage'))
      return
    }

    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setEmailError(t('onboarding.companyGate.emailRequired'))
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError(t('onboarding.companyGate.emailInvalid'))
      return false
    }
    setEmailError('')
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    let isValid = true
    if (needsEmail && !validateEmail(email)) isValid = false
    if (needsLogo && !logoFile) {
      toast.error(t('onboarding.companyGate.logoRequired'))
      isValid = false
    }
    if (!isValid) return

    setIsSubmitting(true)
    try {
      await completeOnboarding({
        email: needsEmail ? email : undefined,
        logo: needsLogo ? logoFile || undefined : undefined,
      })
      toast.success(t('onboarding.companyGate.successToast'))
      await refresh()
      router.push('/invoices')
    } catch (error) {
      const err = error as Error & { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || err.message || t('onboarding.companyGate.genericError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingStatus) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex w-full max-w-lg flex-col gap-4">
          <div className="h-8 w-48 animate-pulse self-center rounded bg-surface-soft" />
          <div className="h-[320px] animate-pulse rounded-panel bg-surface-soft" />
        </div>
      </div>
    )
  }

  if (!status?.needs_onboarding) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <CheckCircle className="size-12 text-success" />
        <p className="text-lg font-bold text-ink">{t('onboarding.companyGate.alreadyComplete')}</p>
        <p className="text-sm text-subtle">{t('onboarding.companyGate.redirecting')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="flex w-full max-w-lg flex-col gap-5 rounded-panel p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <Building2 className="size-7" strokeWidth={1.8} />
          </span>
          <h1 className="text-xl font-bold text-ink">{t('onboarding.companyGate.title')}</h1>
          <p className="text-sm text-subtle">
            {t('onboarding.companyGate.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {needsLogo ? (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <ImageIcon className="size-4" />
                {t('onboarding.companyGate.logoLabel')}
              </label>

              {logoPreview ? (
                <div className="relative inline-flex size-28 items-center justify-center rounded-tile border-2 border-brand-500 bg-brand-50 p-2">
                  <Image src={logoPreview} alt={t('onboarding.companyGate.logoPreviewAlt')} fill className="object-contain p-2" unoptimized />
                  <button
                    type="button"
                    onClick={removeLogo}
                    disabled={isSubmitting}
                    className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-danger text-white disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => !isSubmitting && fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex flex-col items-center justify-center gap-2 rounded-tile border-[1.5px] border-dashed border-brand-200 bg-brand-50 p-6 text-center text-brand-700 disabled:opacity-50"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface">
                    <ImageIcon className="size-5" strokeWidth={1.8} />
                  </span>
                  <span className="text-sm font-bold">{t('onboarding.companyGate.addLogo')}</span>
                  <span className="text-xs text-ink-3">{t('onboarding.companyGate.logoHint')}</span>
                </button>
              )}
            </div>
          ) : null}

          {needsEmail ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="company-email" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Mail className="size-4" />
                {t('onboarding.companyGate.emailLabel')}
              </label>
              <input
                id="company-email"
                type="email"
                placeholder={t('onboarding.companyGate.emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) validateEmail(e.target.value)
                }}
                onBlur={() => validateEmail(email)}
                disabled={isSubmitting}
                className={`h-12 rounded-field border px-3.5 text-[15px] text-ink disabled:opacity-60 ${
                  emailError ? 'border-danger-border' : 'border-line-strong'
                }`}
              />
              {emailError ? <p className="text-xs text-danger-strong">{emailError}</p> : null}
            </div>
          ) : null}

          <Button type="submit" variant="primary" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t('onboarding.companyGate.submitBusy')}
              </>
            ) : (
              t('onboarding.companyGate.submitIdle')
            )}
          </Button>
        </form>
      </Card>
    </div>
  )
}
