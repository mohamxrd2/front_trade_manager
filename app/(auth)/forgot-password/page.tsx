'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRound, Users } from 'lucide-react'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { requestPasswordReset } from '@/lib/auth'
import { isApiError, ApiErrorType } from '@/lib/api'
import { clearResetTicket, initialEmail, isEmail, resetErrorMessage, VERIFY_PATH, withEmail } from '@/lib/password-reset/flow'
import { AuthError, AuthFlowShell, AuthInput, SubmitButton } from '@/components/auth'

/**
 * Mot de passe oublié, écran 1/3 : l'e-mail du compte. Le backend répond
 * toujours pareil (le compte existe ou non) ; on passe donc à l'écran du
 * code dans tous les cas, sauf limite atteinte ou erreur réseau.
 */
function ForgotPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  const [email, setEmail] = React.useState(() => initialEmail(searchParams.get('email')))
  const [emailError, setEmailError] = React.useState<string>()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEmail(email)) {
      setEmailError(t('auth.forgot.emailInvalid'))
      return
    }
    setEmailError(undefined)
    setServerError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      clearResetTicket()
      router.push(withEmail(VERIFY_PATH, email))
    } catch (error) {
      setSubmitting(false)
      const failure = isApiError(error)
        ? { status: error.status, code: error.code, network: error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT }
        : {}
      const message = resetErrorMessage(failure)
      setServerError(t(message.key, message.params))
    }
  }

  return (
    <AuthFlowShell
      icon={<KeyRound className="size-7" />}
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      backHref={withEmail('/login', email)}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-5 md:flex-none">
        <AuthError>{serverError}</AuthError>
        <AuthInput
          label={t('auth.forgot.emailLabel')}
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) setEmailError(undefined)
          }}
          error={emailError}
        />
        <SubmitButton isSubmitting={submitting} idleLabel={t('auth.forgot.sendIdle')} busyLabel={t('auth.forgot.sendBusy')} />

        <div className="flex gap-3 rounded-[14px] border border-[#ECECF2] bg-white/70 px-3.5 py-3 text-sm text-[#4B4B5C]">
          <Users className="mt-0.5 size-4 shrink-0 text-[#6B6B7B]" aria-hidden="true" />
          <p>{t('auth.forgot.memberHint')}</p>
        </div>

        <Link href={withEmail('/login', email)} className="flex min-h-11 items-center self-start text-sm font-semibold text-[#4B4B5C]">
          {t('auth.forgot.backToLogin')}
        </Link>
      </form>
    </AuthFlowShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ForgotPasswordInner />
    </React.Suspense>
  )
}
