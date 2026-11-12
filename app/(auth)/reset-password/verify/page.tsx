'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { requestPasswordReset, verifyPasswordResetCode } from '@/lib/auth'
import { isApiError, ApiErrorType } from '@/lib/api'
import {
  CODE_LENGTH,
  FORGOT_PATH,
  NEW_PASSWORD_PATH,
  RESEND_COOLDOWN,
  formatCountdown,
  initialEmail,
  resetErrorMessage,
  saveResetTicket,
  withEmail,
  type ResetApiFailure,
} from '@/lib/password-reset/flow'
import { AuthError, AuthFlowShell, OtpInput, SubmitButton } from '@/components/auth'

function failureOf(error: unknown): ResetApiFailure {
  if (!isApiError(error)) return {}
  const body = error.originalError?.response?.data as { remaining?: unknown } | undefined
  return {
    status: error.status,
    code: error.code,
    remaining: typeof body?.remaining === 'number' ? body.remaining : undefined,
    network: error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT,
  }
}

/**
 * Mot de passe oublié, écran 2/3 : le code reçu par e-mail (même grille que
 * /verify, envoi automatique au 6e chiffre). Le code est échangé contre un
 * jeton gardé en sessionStorage pour l'écran 3 — jamais dans l'URL.
 */
function ResetVerifyInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const email = initialEmail(searchParams.get('email'))

  const [code, setCode] = React.useState('')
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [verifying, setVerifying] = React.useState(false)
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_COOLDOWN)
  const [resending, setResending] = React.useState(false)

  React.useEffect(() => {
    if (!email) router.replace(FORGOT_PATH)
  }, [email, router])

  React.useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const submit = React.useCallback(
    async (fullCode: string) => {
      if (!email || verifying) return
      setVerifying(true)
      setCodeError(null)
      setServerError(null)
      try {
        const { token, expiresIn } = await verifyPasswordResetCode(email, fullCode)
        saveResetTicket({ email, token, expiresAt: Date.now() + expiresIn * 1000 })
        router.replace(withEmail(NEW_PASSWORD_PATH, email))
      } catch (error) {
        setVerifying(false)
        setCode('')
        const failure = failureOf(error)
        const message = resetErrorMessage(failure)
        if (failure.network || (!failure.code && failure.status !== 429)) setServerError(t(message.key, message.params))
        else setCodeError(t(message.key, message.params))
      }
    },
    [email, verifying, router, t]
  )

  const handleResend = async () => {
    if (!email || secondsLeft > 0 || resending) return
    setResending(true)
    setServerError(null)
    try {
      await requestPasswordReset(email)
      setSecondsLeft(RESEND_COOLDOWN)
      setCode('')
      setCodeError(null)
      toast.success(t('auth.verify.resentSuccess'))
    } catch (error) {
      const message = resetErrorMessage(failureOf(error))
      setServerError(t(message.key, message.params))
    } finally {
      setResending(false)
    }
  }

  if (!email) return null

  return (
    <AuthFlowShell
      icon={<Mail className="size-7" />}
      title={t('auth.forgot.verifyTitle')}
      subtitle={t('auth.forgot.verifySubtitle', { email })}
      backHref={withEmail(FORGOT_PATH, email)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === CODE_LENGTH) void submit(code)
        }}
        className="flex flex-1 flex-col gap-5 md:flex-none"
      >
        <AuthError>{serverError}</AuthError>
        <div>
          <OtpInput
            length={CODE_LENGTH}
            value={code}
            onChange={(next) => {
              setCode(next)
              if (codeError) setCodeError(null)
            }}
            onComplete={(full) => void submit(full)}
            error={!!codeError}
            disabled={verifying}
            legend={t('auth.forgot.codeLegend')}
            legendClassName="mb-2.5 block text-[13px] font-semibold text-[#0E0E1A]"
            containerClassName="gap-2"
            boxClassName="h-[58px] w-[46px] rounded-[14px] text-2xl md:h-16 md:w-16 md:rounded-[18px] md:text-[26px]"
          />
          <p role="alert" aria-live="assertive" className="mt-2 min-h-5 text-sm font-semibold text-[#A3213A]">
            {codeError}
          </p>
        </div>

        <p className="text-sm text-[#6B6B7B]" aria-live="polite">
          {t('auth.verify.notReceived')}{' '}
          {secondsLeft > 0 ? (
            <span className="text-[#8A8A9A]">{t('auth.verify.resendIn', { time: formatCountdown(secondsLeft) })}</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="relative font-semibold text-[#5B3FE6] after:absolute after:-inset-3 disabled:opacity-60"
            >
              {t('auth.verify.resend')}
            </button>
          )}
        </p>

        <div className="flex-1 md:hidden" />
        <SubmitButton isSubmitting={verifying} idleLabel={t('auth.forgot.verifyIdle')} busyLabel={t('auth.forgot.verifyBusy')} />

        <Link href={withEmail(FORGOT_PATH, email)} className="flex min-h-11 items-center self-start text-sm font-semibold text-[#4B4B5C]">
          {t('auth.forgot.changeEmail')}
        </Link>
      </form>
    </AuthFlowShell>
  )
}

export default function ResetVerifyPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetVerifyInner />
    </React.Suspense>
  )
}
