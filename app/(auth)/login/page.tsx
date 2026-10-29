'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAuth } from '@/contexts/AuthContext'
import { getSocialAuthErrorMessage } from '@/lib/services/social-auth'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { homeRouteForUser } from '@/lib/permissions/home-route'
import {
  AuthLogo,
  AuthInput,
  PasswordInput,
  SocialButtons,
  Divider,
  SubmitButton,
  AuthError,
} from '@/components/auth'

/**
 * Connexion — design/maquettes/ordinateur/Web-Connexion.dc.html (≥ 768px) et
 * design/maquettes/mobile/Connexion.dc.html (< 768px). Un seul formulaire
 * (react-hook-form + zod), deux rendus (hidden md:flex / md:hidden).
 *
 * Écart assumé vs. la maquette mobile : le lien "Créer un compte" y pointe
 * vers Vérification.dc.html — erreur de la maquette, câblé vers /signup ici.
 */

function buildLoginSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z.object({
    login: z.string().min(1, t('auth.login.validationLoginRequired')),
    password: z.string().min(1, t('auth.login.validationPasswordRequired')),
    remember: z.boolean(),
  })
}

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>

/** Protection open-redirect : ?next= doit être un chemin interne commençant par "/" (pas "//hôte-externe"). */
function isSafeNext(path: string | null): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const { t } = useTranslation()
  const [authError, setAuthError] = React.useState<string | null>(null)

  const prefillLogin = searchParams.get('email') ?? ''
  const socialError = getSocialAuthErrorMessage(searchParams.get('error'), searchParams.get('provider'))

  const loginSchema = React.useMemo(() => buildLoginSchema(t), [t])
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { login: prefillLogin, password: '', remember: true },
  })

  const loginFieldValue = useWatch({ control, name: 'login' })
  // Un identifiant de membre ({CODE}-{PRENOM}) ne contient jamais "@" — voir
  // TeamService::createMemberAccount(). Connexion sociale réservée au
  // propriétaire (section 5 du chantier "Équipe").
  const blockSocialForMemberIdentifier = () => {
    const value = loginFieldValue ?? ''
    if (value.trim().length > 0 && !value.includes('@')) {
      setAuthError(t('auth.login.errorSocialMembersOnly'))
      return false
    }
    return true
  }

  React.useEffect(() => {
    if (socialError) setAuthError(socialError)
  }, [socialError])

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null)

    const result = await login({ login: values.login, password: values.password, remember: values.remember })

    if (result.success) {
      if (result.user?.must_change_password) {
        router.replace('/change-password')
        return
      }
      if (!result.onboardingComplete) {
        router.replace('/onboarding')
        return
      }
      const next = searchParams.get('next')
      router.replace(isSafeNext(next) ? next : homeRouteForUser(result.user))
      return
    }

    if (result.emailVerificationRequired) {
      router.replace(`/verify?email=${encodeURIComponent(result.emailVerificationRequired.email)}&from=login`)
      return
    }

    if (result.status === 403 && result.code === 'ACCOUNT_SUSPENDED') {
      setAuthError(t('auth.login.errorSuspended'))
    } else if (result.status === 401) {
      setAuthError(t('auth.login.errorInvalidCredentials'))
    } else if (result.status === 429) {
      const minutes = result.retryAfterSeconds ? Math.max(1, Math.ceil(result.retryAfterSeconds / 60)) : null
      setAuthError(
        minutes ? t('auth.login.errorTooManyAttempts', { minutes }) : t('auth.login.errorTooManyAttemptsGeneric')
      )
    } else if (result.errorType === 'NETWORK_ERROR' || result.errorType === 'TIMEOUT_ERROR') {
      setAuthError(t('auth.login.errorNetwork'))
    } else {
      setAuthError(result.error || t('auth.login.errorGeneric'))
    }
  }

  const forgotPasswordDesktop = (
    <Link href="/forgot-password" className="text-[13px] font-semibold text-[#4B2FD6]">
      {t('auth.login.forgotPassword')}
    </Link>
  )
  const forgotPasswordMobile = (
    <Link href="/forgot-password" className="text-[13px] font-semibold text-[#4B2FD6]">
      {t('auth.login.forgotPasswordShort')}
    </Link>
  )

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div className="hidden min-h-screen flex-wrap gap-5 bg-[#F3F3F7] p-5 md:flex">
        <div
          className="flex min-h-[560px] flex-[1_1_480px] flex-col justify-between gap-10 rounded-[32px] p-10 text-white"
          style={{
            background:
              'radial-gradient(120% 120% at 100% 100%, #3A3AF0 0%, #1717A0 35%, #0A0A4A 70%, #06062A 100%)',
          }}
        >
          <AuthLogo size={40} textClassName="text-white" />

          <div className="flex max-w-[520px] flex-col gap-5">
            <h1 className="text-[clamp(32px,3.4vw,46px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
              {t('auth.login.heroTitle')}
            </h1>
            <p className="text-[17px] leading-[1.55] text-[#DCDCF7]">
              {t('auth.login.heroSubtitleDesktop')}
            </p>
          </div>

          <div className="flex flex-wrap gap-4" aria-hidden="true">
            <div className="flex-[1_1_180px] rounded-[20px] border border-white/18 bg-white/10 p-4">
              <span className="block text-xs text-[#C8C8F0]">{t('auth.login.monthlyBalance')}</span>
              <span className="block text-xl font-bold">1 245 000 F</span>
            </div>
            <div className="flex-[1_1_180px] rounded-[20px] border border-white/18 bg-white/10 p-4">
              <span className="block text-xs text-[#C8C8F0]">{t('auth.login.paidInvoices')}</span>
              <span className="block text-xl font-bold">{t('auth.login.paidInvoicesCount')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-[1_1_440px] items-center justify-center px-5 py-10">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full max-w-[420px] flex-col gap-[18px]">
            <div className="flex flex-col gap-1">
              <h2 className="text-[32px] font-extrabold tracking-[-0.02em] text-[#0E0E1A]">{t('auth.login.title')}</h2>
              <p className="text-[15px] text-[#6B6B7B]">{t('auth.login.subtitle')}</p>
            </div>

            <AuthError>{authError}</AuthError>

            <SocialButtons onBeforeNavigate={blockSocialForMemberIdentifier} />
            <Divider>{t('auth.login.orWithEmail')}</Divider>

            <Controller
              control={control}
              name="login"
              render={({ field }) => (
                <AuthInput
                  label={t('auth.login.identifierLabel')}
                  id="login-identifier-desktop"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  error={errors.login?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <PasswordInput
                  label={t('auth.login.passwordOrCodeLabel')}
                  id="login-password-desktop"
                  autoComplete="current-password"
                  labelRight={forgotPasswordDesktop}
                  error={errors.password?.message}
                  {...field}
                />
              )}
            />

            <label className="flex min-h-11 items-center gap-2.5 text-sm text-[#0E0E1A]">
              <input type="checkbox" className="size-5 accent-[#5B3FE6]" {...register('remember')} />
              {t('auth.login.rememberMe')}
            </label>

            <SubmitButton isSubmitting={isSubmitting} idleLabel={t('auth.login.submitIdle')} busyLabel={t('auth.login.submitBusy')} />

            <p className="text-center text-sm text-[#6B6B7B]">
              {t('auth.login.noAccount')}{' '}
              <Link href="/signup" className="font-bold text-[#0E0E1A]">
                {t('auth.login.createAccount')}
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* ============================= MOBILE (< 768px / md) ============================= */}
      <div className="flex min-h-screen flex-col bg-[#F3F3F7] md:hidden">
        <div
          className="flex flex-col gap-7 rounded-b-[32px] px-7 pb-10 text-white"
          style={{
            paddingTop: 'calc(72px + env(safe-area-inset-top))',
            background: 'radial-gradient(120% 90% at 100% 100%, #3A3AF0 0%, #1717A0 35%, #0A0A4A 70%, #06062A 100%)',
          }}
        >
          <AuthLogo size={40} textClassName="text-white" />
          <div className="flex flex-col gap-3">
            <h1 className="text-[32px] font-bold leading-[1.1]">
              {t('auth.login.heroTitle')}
            </h1>
            <p className="text-[15px] text-[#C8C8F0]">{t('auth.login.heroSubtitleMobile')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-7">
          <AuthError>{authError}</AuthError>

          <Controller
            control={control}
            name="login"
            render={({ field }) => (
              <AuthInput
                label={t('auth.login.identifierLabel')}
                id="login-identifier-mobile"
                type="text"
                autoComplete="username"
                error={errors.login?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <PasswordInput
                label={t('auth.login.passwordOrCodeLabel')}
                id="login-password-mobile"
                autoComplete="current-password"
                labelRight={forgotPasswordMobile}
                error={errors.password?.message}
                {...field}
              />
            )}
          />

          <SubmitButton isSubmitting={isSubmitting} idleLabel={t('auth.login.submitIdle')} busyLabel={t('auth.login.submitBusy')} className="mt-1" />

          <Divider>{t('auth.login.or')}</Divider>
          <SocialButtons onBeforeNavigate={blockSocialForMemberIdentifier} />

          <div className="flex-1" />

          <p className="text-center text-sm text-[#6B6B7B]">
            {t('auth.login.noAccount')}{' '}
            <Link href="/signup" className="font-bold text-[#0E0E1A]">
              {t('auth.login.createAccount')}
            </Link>
          </p>
        </form>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginPageInner />
    </React.Suspense>
  )
}
