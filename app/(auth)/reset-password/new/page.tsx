'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { missingPasswordRequirements, PASSWORD_REQUIREMENT_KEYS } from '@/lib/password-rules'
import {
  FORGOT_PATH,
  clearResetTicket,
  initialEmail,
  loadResetTicket,
  resetErrorMessage,
  withEmail,
  type ResetTicket,
} from '@/lib/password-reset/flow'
import { AuthError, AuthFlowShell, PasswordInput, PasswordStrengthGauge, SubmitButton } from '@/components/auth'

/**
 * Mot de passe oublié, écran 3/3 : le nouveau mot de passe. Il faut le jeton
 * obtenu à l'écran 2 (sessionStorage) ; sans lui, retour à l'écran 1. Après
 * succès, le backend a déjà connecté l'utilisateur : direction le tableau de
 * bord (ou l'onboarding s'il n'est pas terminé).
 */
function ResetNewPasswordInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const { completePasswordReset } = useAuth()

  const [ticket, setTicket] = React.useState<ResetTicket | null>(null)
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [passwordError, setPasswordError] = React.useState<string>()
  const [confirmError, setConfirmError] = React.useState<string>()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [expired, setExpired] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const queryEmail = initialEmail(searchParams.get('email'))

  React.useEffect(() => {
    const found = loadResetTicket()
    if (!found) {
      router.replace(withEmail(FORGOT_PATH, queryEmail))
      return
    }
    setTicket(found)
  }, [router, queryEmail])

  const validatePassword = (value: string) => {
    const missing = missingPasswordRequirements(value).map((req) => t(PASSWORD_REQUIREMENT_KEYS[req]))
    return missing.length ? `${t('auth.signup.passwordMissingPrefix')}${missing.join(', ')}.` : undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ticket || submitting) return
    const nextPasswordError = validatePassword(password)
    const nextConfirmError = confirm === password ? undefined : t('auth.forgot.passwordMismatch')
    setPasswordError(nextPasswordError)
    setConfirmError(nextConfirmError)
    if (nextPasswordError || nextConfirmError) return

    setSubmitting(true)
    setServerError(null)
    const result = await completePasswordReset({
      email: ticket.email,
      reset_token: ticket.token,
      password,
      password_confirmation: confirm,
    })

    if (result.success) {
      clearResetTicket()
      toast.success(t('auth.forgot.success'))
      router.replace(result.onboardingComplete ? '/dashboard' : '/onboarding')
      return
    }

    setSubmitting(false)
    if (result.passwordRejected) {
      setPasswordError(validatePassword(password) ?? t('auth.forgot.genericError'))
      return
    }
    if (result.code === 'TOKEN_INVALID') {
      clearResetTicket()
      setExpired(true)
    }
    const message = resetErrorMessage(result)
    setServerError(t(message.key, message.params))
  }

  if (!ticket) return null

  return (
    <AuthFlowShell
      icon={<LockKeyhole className="size-7" />}
      title={t('auth.forgot.newTitle')}
      subtitle={t('auth.forgot.newSubtitle', { email: ticket.email })}
      backHref={withEmail(FORGOT_PATH, ticket.email)}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-5 md:flex-none">
        <AuthError>
          {serverError ? (
            <span className="flex flex-wrap items-center gap-x-2">
              {serverError}
              {expired ? (
                <Link href={withEmail(FORGOT_PATH, ticket.email)} className="inline-flex min-h-11 items-center underline">
                  {t('auth.forgot.restart')}
                </Link>
              ) : null}
            </span>
          ) : null}
        </AuthError>

        {/* Pour les gestionnaires de mots de passe : l'identifiant du compte. */}
        <input type="email" name="email" autoComplete="username" value={ticket.email} readOnly hidden />

        <div className="flex flex-col gap-2.5">
          <PasswordInput
            label={t('auth.forgot.passwordLabel')}
            id="reset-password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passwordError) setPasswordError(undefined)
            }}
            error={passwordError}
          />
          <PasswordStrengthGauge password={password} />
        </div>
        <PasswordInput
          label={t('auth.forgot.confirmLabel')}
          id="reset-password-confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            if (confirmError) setConfirmError(undefined)
          }}
          error={confirmError}
        />

        <div className="flex-1 md:hidden" />
        <SubmitButton
          isSubmitting={submitting}
          idleLabel={t('auth.forgot.saveIdle')}
          busyLabel={t('auth.forgot.saveBusy')}
          disabled={expired}
        />
      </form>
    </AuthFlowShell>
  )
}

export default function ResetNewPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetNewPasswordInner />
    </React.Suspense>
  )
}
