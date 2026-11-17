'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Mail, Image as ImageIcon, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useCompanyOnboarding, completeOnboarding, type MissingField } from '@/hooks/useCompanyOnboarding'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { Button, Card } from '@/components/waelly'
import { ImageUploader } from '@/components/media/image-uploader'

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
  // Le logo est envoyé dès qu'il est choisi (l'entreprise existe déjà ici).
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoadingStatus && status && !status.needs_onboarding) {
      router.replace('/invoices')
    }
  }, [isLoadingStatus, status, router])

  const isMissing = (field: MissingField) => status?.missing_fields.includes(field) ?? false
  const needsLogo = isMissing('logo')
  const needsEmail = isMissing('email')

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
    if (needsLogo && !logoUrl) {
      toast.error(t('onboarding.companyGate.logoRequired'))
      isValid = false
    }
    if (!isValid) return

    setIsSubmitting(true)
    try {
      await completeOnboarding({
        email: needsEmail ? email : undefined,
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

              <ImageUploader
                kind="logo"
                ownerId="company"
                value={logoUrl}
                onChange={(media) => setLogoUrl(media?.url ?? null)}
                alt={t('onboarding.companyGate.logoPreviewAlt')}
                previewClassName="size-28"
                disabled={isSubmitting}
              />
              <p className="text-xs text-ink-3">{t('onboarding.companyGate.logoHint')}</p>
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
