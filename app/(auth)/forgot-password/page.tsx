'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { requestPasswordReset, resetPassword } from '@/lib/auth'
import { ApiErrorType, isApiError } from '@/lib/api'
import { AuthError, AuthInput, OtpInput, PasswordInput, SubmitButton } from '@/components/auth'

/**
 * Mot de passe oublié, en deux temps sur la même page :
 * 1. l'e-mail → POST /api/password/forgot (réponse identique si le compte n'existe pas) ;
 * 2. le code à 6 chiffres + le nouveau mot de passe → POST /api/password/reset.
 * Même habillage que /verify : carte en verre centrée (≥ 768px), pleine page sur mobile.
 */

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Mêmes règles que le backend : Password::min(8)->mixedCase()->numbers()->symbols()
const isStrongPassword = (p: string) =>
  p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ForgotPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  const [step, setStep] = React.useState<'email' | 'reset'>('email')
  const [email, setEmail] = React.useState(searchParams.get('email') ?? '')
  const [emailError, setEmailError] = React.useState<string>()
  const [code, setCode] = React.useState('')
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [passwordError, setPasswordError] = React.useState<string>()
  const [confirmError, setConfirmError] = React.useState<string>()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [secondsLeft, setSecondsLeft] = React.useState(0)

  React.useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const errorMessage = (error: unknown) =>
    isApiError(error) && (error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT)
      ? t('auth.forgot.networkError')
      : t('auth.forgot.genericError')

  const sendCode = async () => {
    setSubmitting(true)
    setServerError(null)
    try {
      await requestPasswordReset(email.trim())
      setSecondsLeft(RESEND_COOLDOWN)
      return true
    } catch (error) {
      setServerError(errorMessage(error))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t('auth.forgot.emailInvalid'))
      return
    }
    setEmailError(undefined)
    if (await sendCode()) setStep('reset')
  }

  const handleResend = async () => {
    if (secondsLeft > 0 || submitting) return
    if (await sendCode()) {
      setCode('')
      setCodeError(null)
      toast.success(t('auth.verify.resentSuccess'))
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextCodeError = code.length === CODE_LENGTH ? null : t('auth.forgot.codeRequired')
    const nextPasswordError = isStrongPassword(password) ? undefined : t('auth.forgot.passwordWeak')
    const nextConfirmError = confirm === password ? undefined : t('auth.forgot.passwordMismatch')
    setCodeError(nextCodeError)
    setPasswordError(nextPasswordError)
    setConfirmError(nextConfirmError)
    if (nextCodeError || nextPasswordError || nextConfirmError) return

    setSubmitting(true)
    setServerError(null)
    try {
      await resetPassword({ email: email.trim(), code, password, password_confirmation: confirm })
      toast.success(t('auth.forgot.success'))
      router.replace('/login')
    } catch (error) {
      setSubmitting(false)
      const status = isApiError(error) ? error.status : undefined
      const body = isApiError(error)
        ? (error.originalError?.response?.data as { code?: string; remaining?: number } | undefined)
        : undefined

      if (status === 410) {
        setCode('')
        setCodeError(t('auth.verify.codeExpired'))
      } else if (status === 429) {
        setCode('')
        setCodeError(t('auth.verify.tooManyAttempts'))
      } else if (status === 422 && body?.code === 'INVALID_CODE') {
        setCode('')
        setCodeError(
          typeof body.remaining === 'number'
            ? t('auth.verify.incorrectCodeWithRemaining', { remaining: body.remaining })
            : t('auth.verify.incorrectCode')
        )
      } else if (status === 422) {
        setPasswordError(t('auth.forgot.passwordWeak'))
      } else {
        setServerError(errorMessage(error))
      }
    }
  }

  const backHref = step === 'email' ? '/login' : undefined
  const goBack = () => {
    setStep('email')
    setServerError(null)
    setCodeError(null)
  }

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[#F3F3F7] px-6 md:items-center md:justify-center md:p-5"
      style={{
        paddingTop: 'max(calc(56px + env(safe-area-inset-top)), 20px)',
        paddingBottom: 'calc(36px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex w-full flex-col gap-6 md:max-w-[500px] md:rounded-[32px] md:border md:border-white/90 md:bg-white/70 md:p-10 md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_30px_70px_rgba(17,17,80,0.14)] md:backdrop-blur-2xl">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={t('auth.forgot.back')}
            className="flex size-11 items-center justify-center rounded-full border border-[#ECECF2] bg-white md:hidden"
          >
            <ArrowLeft className="size-5 text-[#0E0E1A]" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={goBack}
            aria-label={t('auth.forgot.back')}
            className="flex size-11 items-center justify-center rounded-full border border-[#ECECF2] bg-white md:hidden"
          >
            <ArrowLeft className="size-5 text-[#0E0E1A]" />
          </button>
        )}

        <div className="flex flex-col items-start gap-3">
          <div className="flex size-16 items-center justify-center rounded-[20px] bg-[#EEEAFE] text-[#5B3FE6]">
            <KeyRound className="size-7" />
          </div>
          <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0E0E1A]">
            {step === 'email' ? t('auth.forgot.title') : t('auth.forgot.resetTitle')}
          </h1>
          <p className="text-[15px] text-[#6B6B7B]">
            {step === 'email' ? t('auth.forgot.subtitle') : t('auth.forgot.resetSubtitle', { email: email.trim() })}
          </p>
        </div>

        <AuthError>{serverError}</AuthError>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} noValidate className="flex flex-col gap-5">
            <AuthInput
              label={t('auth.forgot.emailLabel')}
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <SubmitButton isSubmitting={submitting} idleLabel={t('auth.forgot.sendIdle')} busyLabel={t('auth.forgot.sendBusy')} />
            <p className="text-sm text-[#6B6B7B]">{t('auth.forgot.memberHint')}</p>
            <Link href="/login" className="hidden min-h-11 items-center text-sm font-semibold text-[#4B4B5C] md:flex">
              {t('auth.forgot.backToLogin')}
            </Link>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} noValidate className="flex flex-col gap-5">
            <div>
              <OtpInput
                length={CODE_LENGTH}
                value={code}
                onChange={(next) => {
                  setCode(next)
                  if (codeError) setCodeError(null)
                }}
                error={!!codeError}
                disabled={submitting}
                legend={t('auth.forgot.codeLegend')}
                legendClassName="mb-2.5 block text-[13px] font-semibold text-[#0E0E1A]"
                containerClassName="gap-2"
                boxClassName="h-[58px] w-[46px] rounded-[14px] text-2xl"
              />
              {codeError ? (
                <p role="alert" className="mt-2 text-sm font-semibold text-[#A3213A]">
                  {codeError}
                </p>
              ) : null}
              <p className="mt-3 text-sm text-[#6B6B7B]">
                {t('auth.verify.notReceived')}{' '}
                {secondsLeft > 0 ? (
                  <span className="text-[#B9B9C8]">{t('auth.verify.resendIn', { time: formatCountdown(secondsLeft) })}</span>
                ) : (
                  <button type="button" onClick={handleResend} disabled={submitting} className="font-semibold text-[#5B3FE6] disabled:opacity-60">
                    {t('auth.verify.resend')}
                  </button>
                )}
              </p>
            </div>

            <PasswordInput
              label={t('auth.forgot.passwordLabel')}
              id="forgot-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (passwordError) setPasswordError(undefined)
              }}
              error={passwordError}
            />
            <p className="-mt-3 text-xs text-[#6B6B7B]">{t('auth.forgot.passwordRules')}</p>
            <PasswordInput
              label={t('auth.forgot.confirmLabel')}
              id="forgot-password-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                if (confirmError) setConfirmError(undefined)
              }}
              error={confirmError}
            />

            <SubmitButton isSubmitting={submitting} idleLabel={t('auth.forgot.submitIdle')} busyLabel={t('auth.forgot.submitBusy')} />
            <button type="button" onClick={goBack} className="hidden min-h-11 items-center text-sm font-semibold text-[#4B4B5C] md:flex">
              {t('auth.forgot.changeEmail')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ForgotPasswordInner />
    </React.Suspense>
  )
}
