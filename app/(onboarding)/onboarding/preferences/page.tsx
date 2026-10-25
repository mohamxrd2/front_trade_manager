'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useSettings } from '@/contexts/SettingsContext'
import { getCompany } from '@/lib/services/company'
import { completeOnboarding, skipOnboarding } from '@/lib/services/onboarding'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { SubmitButton } from '@/components/auth'
import { StepsAside, StepsBar, OnboardingSelect, StockThresholdStepper } from '@/components/onboarding'
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

/**
 * Onboarding, étape 3 — même gabarit que l'étape 2 (pas de maquette dédiée).
 * Mêmes valeurs que Paramètres > Préférences : même API (updateSettings),
 * même clé de cache (keys.settings) — voir contexts/SettingsContext.tsx.
 */

// FCFA (XOF)/Euro/Dollar : le code devise reste identique quelle que soit la
// langue (convention internationale) — même liste que app/(dashboard)/settings/page.tsx.
const CURRENCY_OPTIONS = [
  { value: 'FCFA', label: 'FCFA (XOF)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'Dollar (USD)' },
]
// Le nom d'une langue s'affiche toujours DANS cette langue, jamais traduit.
const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' }, // i18n:allow — nom de langue affiché dans sa propre langue, jamais traduit
  { value: 'en', label: 'English' },
]
const DRAFT_KEY = 'onboarding-draft-preferences'

const preferencesSchema = z.object({
  currency: z.string().min(1),
  language: z.string().min(1),
  lowStockThreshold: z.number().min(0).max(100),
})

type PreferencesFormValues = z.infer<typeof preferencesSchema>

const DEFAULT_VALUES: PreferencesFormValues = {
  currency: 'FCFA',
  language: 'fr',
  lowStockThreshold: 80,
}

function readDraft(): Partial<PreferencesFormValues> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeDraft(values: PreferencesFormValues) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values))
}

function clearDraft() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(DRAFT_KEY)
}

export default function OnboardingPreferencesPage() {
  const router = useRouter()
  const { settings, updateSettings } = useSettings()
  const { t } = useTranslation()
  const h1Ref = React.useRef<HTMLHeadingElement>(null)

  const [loadingExisting, setLoadingExisting] = React.useState(true)
  const [skipDialogOpen, setSkipDialogOpen] = React.useState(false)
  const [skipping, setSkipping] = React.useState(false)

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const values = watch()

  React.useEffect(() => {
    h1Ref.current?.focus()
  }, [])

  // Pré-remplissage : brouillon en priorité, sinon les préférences déjà
  // enregistrées (même source que Paramètres), sinon les valeurs par défaut.
  React.useEffect(() => {
    let cancelled = false

    const draft = readDraft()
    if (draft) {
      reset({ ...DEFAULT_VALUES, ...draft })
      setLoadingExisting(false)
      return () => {
        cancelled = true
      }
    }

    if (settings) {
      reset({
        currency: settings.currency || DEFAULT_VALUES.currency,
        language: settings.language || DEFAULT_VALUES.language,
        lowStockThreshold: settings.low_stock_threshold ?? DEFAULT_VALUES.lowStockThreshold,
      })
    }
    setLoadingExisting(false)

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  React.useEffect(() => {
    if (loadingExisting) return
    writeDraft(values)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), loadingExisting])

  const onSubmit = async (data: PreferencesFormValues) => {
    try {
      await updateSettings(
        {
          currency: data.currency,
          language: data.language,
          low_stock_threshold: data.lowStockThreshold,
        },
        { silent: true }
      )
      await completeOnboarding()
      clearDraft()

      // Récupéré ici plutôt que via un state posé par un effect au montage :
      // sinon un clic rapide sur Terminer pouvait soumettre avant que la
      // requête de pré-remplissage n'ait eu le temps de résoudre, et le
      // toast perdait silencieusement le nom de l'entreprise.
      const company = await getCompany().catch(() => null)
      toast.success(t('onboarding.preferences.welcomeToast', { companySuffix: company?.name ? `, ${company.name}` : '' }))
      router.replace('/dashboard')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('onboarding.preferences.saveError'))
    }
  }

  const handleSkip = async () => {
    setSkipping(true)
    try {
      await skipOnboarding()
      clearDraft()
      router.replace('/dashboard')
    } catch {
      toast.error(t('onboarding.preferences.skipError'))
      setSkipping(false)
    }
  }

  if (loadingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#5B3FE6]" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div
        className="hidden min-h-screen flex-wrap items-start gap-5 p-5 md:flex"
        style={{
          background:
            'radial-gradient(700px 480px at 0% 0%, rgba(106,76,240,.22), transparent 70%), radial-gradient(800px 560px at 100% 100%, rgba(58,58,240,.14), transparent 70%), #F1F2F7',
        }}
      >
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-start gap-5">
          <StepsAside current={3} />

          <main className="flex flex-[999_1_560px] flex-col gap-[26px] rounded-[28px] bg-white p-9 shadow-[0_4px_18px_rgba(17,17,80,0.05)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-bold text-[#4B2FD6]">{t('onboarding.preferences.stepLabel')}</span>
              <h1
                ref={h1Ref}
                tabIndex={-1}
                className="text-[30px] font-extrabold tracking-[-0.02em] text-[#0E0E1A] outline-none"
              >
                {t('onboarding.preferences.title')}
              </h1>
              <p className="text-[15px] text-[#6B6B7B]">{t('onboarding.preferences.subtitle')}</p>
            </div>

            <div
              className="grid gap-[18px]"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}
            >
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <OnboardingSelect
                    {...field}
                    label={t('onboarding.preferences.currencyLabel')}
                    id="currency-desktop"
                    options={CURRENCY_OPTIONS.map((o) => o.label)}
                    value={CURRENCY_OPTIONS.find((o) => o.value === field.value)?.label}
                    onChange={(e) => field.onChange(CURRENCY_OPTIONS.find((o) => o.label === e.target.value)?.value)}
                  />
                )}
              />
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <OnboardingSelect
                    {...field}
                    label={t('onboarding.preferences.languageLabel')}
                    id="language-desktop"
                    options={LANGUAGE_OPTIONS.map((o) => o.label)}
                    value={LANGUAGE_OPTIONS.find((o) => o.value === field.value)?.label}
                    onChange={(e) => field.onChange(LANGUAGE_OPTIONS.find((o) => o.label === e.target.value)?.value)}
                  />
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[#0E0E1A]">{t('onboarding.preferences.lowStockLabel')}</span>
              <Controller
                control={control}
                name="lowStockThreshold"
                render={({ field }) => (
                  <StockThresholdStepper value={field.value} onChange={field.onChange} />
                )}
              />
              <p className="text-xs text-[#6B6B7B]">{t('onboarding.preferences.lowStockHint')}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F4] pt-[18px]">
              <button
                type="button"
                onClick={() => router.push('/onboarding/entreprise')}
                className="flex h-[50px] items-center rounded-full border border-[#E2E2EA] px-5 text-[15px] font-bold text-[#0E0E1A]"
              >
                {t('onboarding.preferences.back')}
              </button>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSkipDialogOpen(true)}
                  className="flex h-[50px] items-center px-5 text-[15px] font-semibold text-[#4B4B5C]"
                >
                  {t('onboarding.preferences.skipForNow')}
                </button>
                <SubmitButton
                  isSubmitting={isSubmitting}
                  idleLabel={t('onboarding.preferences.finish')}
                  busyLabel={t('onboarding.preferences.saving')}
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
            <span className="text-[13px] font-semibold text-[#6B6B7B]">{t('onboarding.preferences.stepLabel')}</span>
            <button
              type="button"
              onClick={() => setSkipDialogOpen(true)}
              className="py-3 text-sm font-semibold text-[#5B3FE6]"
            >
              {t('onboarding.company.skip')}
            </button>
          </div>

          <StepsBar current={3} />

          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-bold leading-[1.1] text-[#0E0E1A]">{t('onboarding.preferences.title')}</h1>
            <p className="text-[15px] text-[#6B6B7B]">{t('onboarding.preferences.subtitle')}</p>
          </div>

          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <OnboardingSelect
                {...field}
                label={t('onboarding.preferences.currencyLabel')}
                id="currency-mobile"
                options={CURRENCY_OPTIONS.map((o) => o.label)}
                value={CURRENCY_OPTIONS.find((o) => o.value === field.value)?.label}
                onChange={(e) => field.onChange(CURRENCY_OPTIONS.find((o) => o.label === e.target.value)?.value)}
              />
            )}
          />
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <OnboardingSelect
                {...field}
                label={t('onboarding.preferences.languageLabel')}
                id="language-mobile"
                options={LANGUAGE_OPTIONS.map((o) => o.label)}
                value={LANGUAGE_OPTIONS.find((o) => o.value === field.value)?.label}
                onChange={(e) => field.onChange(LANGUAGE_OPTIONS.find((o) => o.label === e.target.value)?.value)}
              />
            )}
          />
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#0E0E1A]">{t('onboarding.preferences.lowStockLabel')}</span>
            <Controller
              control={control}
              name="lowStockThreshold"
              render={({ field }) => <StockThresholdStepper value={field.value} onChange={field.onChange} />}
            />
            <p className="text-xs text-[#6B6B7B]">{t('onboarding.preferences.lowStockHint')}</p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/onboarding/entreprise')}
            className="flex h-[50px] items-center justify-center rounded-full border border-[#E2E2EA] px-5 text-[15px] font-bold text-[#0E0E1A]"
          >
            {t('onboarding.preferences.back')}
          </button>
        </div>

        <div
          className="sticky bottom-0 border-t border-[#ECECF2] bg-[#F3F3F7] px-6 pt-3.5"
          style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}
        >
          <SubmitButton isSubmitting={isSubmitting} idleLabel={t('onboarding.preferences.finish')} busyLabel={t('onboarding.preferences.saving')} />
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
