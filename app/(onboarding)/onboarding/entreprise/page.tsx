'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { getCompany, updateCompany, uploadCompanyLogo } from '@/lib/services/company'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { SubmitButton } from '@/components/auth'
import {
  StepsAside,
  StepsBar,
  LogoUploadButton,
  OnboardingInput,
  OnboardingSelect,
  IbanInput,
  SectorPills,
  SECTOR_OPTIONS,
  isValidIbanFormat,
} from '@/components/onboarding'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { skipOnboarding } from '@/lib/services/onboarding'

/**
 * Onboarding, étape 2 — design/maquettes/ordinateur/Web-Onboarding.dc.html
 * (≥ 768px) et design/maquettes/mobile/Onboarding.dc.html (< 768px). Un seul
 * formulaire (react-hook-form + zod), deux rendus (hidden md:flex / md:hidden).
 */

const LEGAL_STATUS_OPTIONS = ['Entreprise individuelle', 'SARL', 'SA', 'Auto-entrepreneur'] // i18n:allow — valeur métier stockée en base (company.legal_status), pas encore de clé valeur/affichage séparée
const DRAFT_KEY = 'onboarding-draft-entreprise'

function buildCompanySchema(t: ReturnType<typeof useTranslation>['t']) {
  return z
    .object({
      name: z.string().min(2, t('onboarding.company.validationNameMin')),
      sector: z.string().min(1, t('onboarding.company.validationSectorRequired')),
      sectorOther: z.string().optional(),
      legalStatus: z.string().min(1),
      headquarters: z.string().optional(),
      iban: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.sector === 'Autre' && !data.sectorOther?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['sectorOther'], message: t('onboarding.company.validationSectorOtherRequired') })
      }
      if (data.iban && !isValidIbanFormat(data.iban)) {
        ctx.addIssue({ code: 'custom', path: ['iban'], message: t('onboarding.company.validationIbanInvalid') })
      }
    })
}

type CompanyFormValues = z.infer<ReturnType<typeof buildCompanySchema>>

const DEFAULT_VALUES: CompanyFormValues = {
  name: '',
  sector: '',
  sectorOther: '',
  legalStatus: 'Entreprise individuelle',
  headquarters: '',
  iban: '',
}

function readDraft(): Partial<CompanyFormValues> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeDraft(values: CompanyFormValues) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values))
}

function clearDraft() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(DRAFT_KEY)
}

/** Les 2 rendus posent chacun leur copie de chaque champ avec le même data-field : on
 *  focus + scrolle la copie réellement VISIBLE (l'autre est display:none, offsetParent===null). */
function focusFirstError(fieldName: string) {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-field="${fieldName}"]`)
  for (const el of candidates) {
    if (el.offsetParent !== null) {
      el.focus()
      el.scrollIntoView({ block: 'center' })
      return
    }
  }
}

export default function OnboardingCompanyPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const h1Ref = React.useRef<HTMLHeadingElement>(null)

  const [logoFile, setLogoFile] = React.useState<File | null>(null)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [logoError, setLogoError] = React.useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [loadingExisting, setLoadingExisting] = React.useState(true)
  const [skipDialogOpen, setSkipDialogOpen] = React.useState(false)
  const [skipping, setSkipping] = React.useState(false)

  const companySchema = React.useMemo(() => buildCompanySchema(t), [t])
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    mode: 'onBlur',
    defaultValues: DEFAULT_VALUES,
  })

  const values = watch()
  const sector = watch('sector')

  // Focus le H1 à l'arrivée sur l'étape (design/onboarding § accessibilité).
  React.useEffect(() => {
    h1Ref.current?.focus()
  }, [])

  // Pré-remplissage : brouillon sessionStorage en priorité (saisie non
  // enregistrée plus récente qu'une éventuelle entreprise déjà sauvegardée),
  // sinon l'entreprise existante si l'utilisateur revient sur cette étape.
  React.useEffect(() => {
    let cancelled = false

    const draft = readDraft()
    if (draft) {
      reset({ ...DEFAULT_VALUES, ...draft })
      setLoadingExisting(false)
      return
    }

    getCompany()
      .then((company) => {
        if (cancelled || !company) return
        const knownSector = SECTOR_OPTIONS.includes(company.sector ?? '') && company.sector !== 'Autre'
        reset({
          name: company.name ?? '',
          sector: company.sector ? (knownSector ? company.sector : 'Autre') : '',
          sectorOther: company.sector && !knownSector ? company.sector : '',
          legalStatus: company.legal_status ?? 'Entreprise individuelle',
          headquarters: company.headquarters ?? '',
          iban: company.bank_account_number ?? '',
        })
        if (company.logo_url) setLogoPreview(company.logo_url)
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Brouillon : à chaque frappe, pour ne rien perdre à un F5 (effacé une
  // fois l'étape réellement enregistrée).
  React.useEffect(() => {
    if (loadingExisting) return
    writeDraft(values)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), loadingExisting])

  const handleLogoSelect = (file: File) => {
    setLogoError(null)
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const onSubmit = async (data: CompanyFormValues) => {
    try {
      const resolvedSector = data.sector === 'Autre' ? (data.sectorOther ?? '').trim() : data.sector

      await updateCompany({
        name: data.name,
        sector: resolvedSector || null,
        legal_status: data.legalStatus,
        headquarters: data.headquarters || null,
        bank_account_number: data.iban ? data.iban.replace(/\s/g, '') : null,
      })

      if (logoFile) {
        setUploadProgress(0)
        try {
          await uploadCompanyLogo(logoFile, setUploadProgress)
        } finally {
          setUploadProgress(null)
        }
      }

      clearDraft()
      router.push('/onboarding/preferences')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('onboarding.company.saveError'))
    }
  }

  const onInvalid = (formErrors: typeof errors) => {
    const firstKey = Object.keys(formErrors)[0]
    if (firstKey) focusFirstError(firstKey)
  }

  const handleSkip = async () => {
    setSkipping(true)
    try {
      await skipOnboarding()
      clearDraft()
      router.replace('/dashboard')
    } catch {
      toast.error(t('onboarding.company.skipError'))
      setSkipping(false)
    }
  }

  const legalStatusErrorMsg = errors.legalStatus?.message

  const logoButton = (
    <LogoUploadButton previewUrl={logoPreview} onSelect={handleLogoSelect} error={logoError} />
  )

  const sectorField = (variant: 'ink' | 'violet') => (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-[#0E0E1A]">{t('onboarding.sectorFieldLabel')}</span>
      <Controller
        control={control}
        name="sector"
        render={({ field }) => (
          <div data-field="sector">
            <SectorPills value={field.value} onChange={field.onChange} variant={variant} />
          </div>
        )}
      />
      {errors.sector ? <p className="text-xs font-semibold text-[#A3213A]">{errors.sector.message}</p> : null}
      {sector === 'Autre' ? (
        <Controller
          control={control}
          name="sectorOther"
          render={({ field }) => (
            <OnboardingInput
              {...field}
              label={t('onboarding.company.sectorOtherLabel')}
              id="sectorOther"
              data-field="sectorOther"
              error={errors.sectorOther?.message}
            />
          )}
        />
      ) : null}
    </div>
  )

  if (loadingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#5B3FE6]" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div
        className="hidden min-h-screen flex-wrap items-start gap-5 p-5 md:flex"
        style={{
          background:
            'radial-gradient(700px 480px at 0% 0%, rgba(106,76,240,.22), transparent 70%), radial-gradient(800px 560px at 100% 100%, rgba(58,58,240,.14), transparent 70%), #F1F2F7',
        }}
      >
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-start gap-5">
          <StepsAside current={2} />

          <main className="flex flex-[999_1_560px] flex-col gap-[26px] rounded-[28px] bg-white p-9 shadow-[0_4px_18px_rgba(17,17,80,0.05)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-[#4B2FD6]">{t('onboarding.company.stepLabel')}</span>
              <h1
                ref={h1Ref}
                tabIndex={-1}
                className="text-[30px] font-extrabold tracking-[-0.02em] text-[#0E0E1A] outline-none"
              >
                {t('onboarding.company.title')}
              </h1>
              <p className="text-[15px] text-[#6B6B7B]">
                {t('onboarding.company.subtitleDesktop')}
              </p>
            </div>

            {logoButton}

            <div
              className="grid gap-[18px]"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}
            >
              <Controller
                control={control}
                name="name"
                render={({ field }) => (
                  <OnboardingInput
                    {...field}
                    label={t('onboarding.company.nameLabel')}
                    id="name-desktop"
                    data-field="name"
                    placeholder={t('onboarding.company.namePlaceholder')}
                    error={errors.name?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="legalStatus"
                render={({ field }) => (
                  <OnboardingSelect
                    {...field}
                    label={t('onboarding.company.legalStatusLabel')}
                    id="legalStatus-desktop"
                    data-field="legalStatus"
                    options={LEGAL_STATUS_OPTIONS}
                    error={legalStatusErrorMsg}
                  />
                )}
              />
              <Controller
                control={control}
                name="headquarters"
                render={({ field }) => (
                  <OnboardingInput
                    {...field}
                    label={t('onboarding.company.headquartersLabel')}
                    id="headquarters-desktop"
                    data-field="headquarters"
                    placeholder={t('onboarding.company.headquartersPlaceholder')}
                    error={errors.headquarters?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="iban"
                render={({ field }) => (
                  <IbanInput
                    {...field}
                    label={t('onboarding.company.ibanLabel')}
                    id="iban-desktop"
                    data-field="iban"
                    optionalHint={t('onboarding.company.ibanOptionalHint')}
                    placeholder={t('onboarding.company.ibanPlaceholder')}
                    error={errors.iban?.message}
                  />
                )}
              />
            </div>

            {sectorField('ink')}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F4] pt-[18px]">
              <span />
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSkipDialogOpen(true)}
                  className="flex h-[50px] items-center px-5 text-[15px] font-semibold text-[#4B4B5C]"
                >
                  {t('onboarding.company.skipForNow')}
                </button>
                <SubmitButton
                  isSubmitting={isSubmitting || uploadProgress !== null}
                  idleLabel={t('onboarding.company.continueCta')}
                  busyLabel={uploadProgress !== null ? t('onboarding.company.uploadingLogo', { progress: uploadProgress }) : t('onboarding.company.saving')}
                  className="h-[50px] w-auto px-[26px] shadow-[0_10px_24px_rgba(75,47,214,0.3)]"
                />
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ============================= MOBILE (< 768px / md) ============================= */}
      <div className="flex min-h-[100dvh] flex-col bg-[#F3F3F7] md:hidden">
        <div
          className="flex flex-col gap-[22px] px-6 pb-5"
          style={{ paddingTop: 'calc(56px + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#6B6B7B]">{t('onboarding.company.stepLabel')}</span>
            <button
              type="button"
              onClick={() => setSkipDialogOpen(true)}
              className="py-3 text-sm font-semibold text-[#5B3FE6]"
            >
              {t('onboarding.company.skip')}
            </button>
          </div>

          <StepsBar current={2} />

          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-bold leading-[1.1] text-[#0E0E1A]">{t('onboarding.company.title')}</h1>
            <p className="text-[15px] text-[#6B6B7B]">{t('onboarding.company.subtitleMobile')}</p>
          </div>

          {logoButton}

          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <OnboardingInput
                {...field}
                label={t('onboarding.company.nameLabel')}
                id="name-mobile"
                data-field="name"
                placeholder={t('onboarding.company.namePlaceholder')}
                error={errors.name?.message}
              />
            )}
          />

          {sectorField('violet')}

          <Controller
            control={control}
            name="headquarters"
            render={({ field }) => (
              <OnboardingInput
                {...field}
                label={t('onboarding.company.headquartersLabel')}
                id="headquarters-mobile"
                data-field="headquarters"
                placeholder={t('onboarding.company.headquartersPlaceholder')}
                error={errors.headquarters?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="legalStatus"
            render={({ field }) => (
              <OnboardingSelect
                {...field}
                label={t('onboarding.company.legalStatusLabel')}
                id="legalStatus-mobile"
                data-field="legalStatus"
                options={LEGAL_STATUS_OPTIONS}
                error={legalStatusErrorMsg}
              />
            )}
          />
          <Controller
            control={control}
            name="iban"
            render={({ field }) => (
              <IbanInput
                {...field}
                label={t('onboarding.company.ibanLabel')}
                id="iban-mobile"
                data-field="iban"
                optionalHint={t('onboarding.company.ibanOptionalHint')}
                placeholder={t('onboarding.company.ibanPlaceholder')}
                error={errors.iban?.message}
              />
            )}
          />
        </div>

        <div
          className="sticky bottom-0 border-t border-[#ECECF2] bg-[#F3F3F7] px-6 pt-3.5"
          style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
        >
          <SubmitButton
            isSubmitting={isSubmitting || uploadProgress !== null}
            idleLabel={t('onboarding.company.continueCta')}
            busyLabel={uploadProgress !== null ? t('onboarding.company.uploadingLogo', { progress: uploadProgress }) : t('onboarding.company.saving')}
          />
        </div>
      </div>

      <AlertDialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('onboarding.skipDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('onboarding.skipDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={skipping}>{t('onboarding.skipDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkip} disabled={skipping}>
              {skipping ? t('onboarding.skipDialog.pleaseWait') : t('onboarding.skipDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
