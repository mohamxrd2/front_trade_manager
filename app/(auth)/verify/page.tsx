'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Mail } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { OtpInput, SubmitButton } from '@/components/auth'

/**
 * Vérification du code — design/maquettes/ordinateur/Web-Verification.dc.html
 * (≥ 768px, carte en verre centrée) et design/maquettes/mobile/Verification.dc.html
 * (< 768px, sans carte, aligné à gauche).
 *
 * L'email vient de ?email= (envoyé par /login en cas de compte non vérifié,
 * ou par /signup après l'étape 1). Sans email exploitable, il n'y a rien à
 * vérifier : redirection vers /signup.
 */

const CODE_LENGTH = 6
const RESEND_COOLDOWN = 60

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function VerifyPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verifyRegistration, resendRegistrationCode } = useAuth()
  const { t } = useTranslation()

  const email = searchParams.get('email')
  const backHref = searchParams.get('from') === 'login' ? '/login' : `/signup?email=${encodeURIComponent(email ?? '')}`

  const [code, setCode] = React.useState('')
  const [codeError, setCodeError] = React.useState(false)
  const [codeErrorMessage, setCodeErrorMessage] = React.useState<string | null>(null)
  const [isVerifying, setIsVerifying] = React.useState(false)
  const [secondsLeft, setSecondsLeft] = React.useState(RESEND_COOLDOWN)
  const [resending, setResending] = React.useState(false)

  React.useEffect(() => {
    if (!email) router.replace('/signup')
  }, [email, router])

  React.useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const handleCodeChange = (next: string) => {
    setCode(next)
    if (codeError) setCodeError(false)
  }

  const handleComplete = React.useCallback(
    async (fullCode: string) => {
      if (!email || isVerifying) return
      setIsVerifying(true)
      setCodeErrorMessage(null)

      const result = await verifyRegistration({ email, code: fullCode })
      setIsVerifying(false)

      if (result.success) {
        router.replace(result.onboardingComplete ? '/dashboard' : '/onboarding')
        return
      }

      if (result.status === 404) {
        router.replace('/signup')
        return
      }

      setCode('')
      setCodeError(true)

      if (result.status === 410) {
        setCodeErrorMessage(t('auth.verify.codeExpired'))
      } else if (result.status === 429) {
        setCodeErrorMessage(t('auth.verify.tooManyAttempts'))
      } else {
        // 422 : le backend renvoie "Code incorrect. {n} tentative(s) restante(s)."
        // — reformulé ici au libellé exact demandé, en extrayant le nombre.
        const match = result.error?.match(/(\d+)/)
        const remaining = match?.[1]
        setCodeErrorMessage(
          remaining
            ? t('auth.verify.incorrectCodeWithRemaining', { remaining: Number(remaining) })
            : result.error || t('auth.verify.incorrectCode')
        )
      }
    },
    [email, isVerifying, router, verifyRegistration]
  )

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length === CODE_LENGTH) void handleComplete(code)
  }

  const handleResend = async () => {
    if (!email || secondsLeft > 0 || resending) return
    setResending(true)
    const result = await resendRegistrationCode(email)
    setResending(false)

    if (result.success) {
      setSecondsLeft(RESEND_COOLDOWN)
      toast.success(t('auth.verify.resentSuccess'))
    } else if (result.status === 404) {
      router.replace('/signup')
    } else {
      toast.error(result.error || t('auth.verify.resendError'))
    }
  }

  if (!email) return null

  const resendText = (textColorClass: string) => (
    <p className={`text-sm ${textColorClass}`}>
      {t('auth.verify.notReceived')}{' '}
      {secondsLeft > 0 ? (
        <span className="text-[#B9B9C8]">{t('auth.verify.resendIn', { time: formatCountdown(secondsLeft) })}</span>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-semibold text-[#5B3FE6] disabled:opacity-60"
        >
          {t('auth.verify.resend')}
        </button>
      )}
    </p>
  )

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div
        className="hidden min-h-screen items-center justify-center p-5 md:flex"
        style={{
          background:
            'radial-gradient(700px 500px at 20% 10%, rgba(106,76,240,.28), transparent 70%), radial-gradient(800px 600px at 90% 90%, rgba(58,58,240,.22), transparent 70%), #F1F2F7',
        }}
      >
        <div
          className="flex w-full max-w-[500px] flex-col items-center gap-[22px] rounded-[32px] p-10 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.5))',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.95), 0 30px 70px rgba(17,17,80,0.14)',
          }}
        >
          <div
            className="flex size-[72px] items-center justify-center rounded-[24px] text-white"
            style={{
              background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)',
              boxShadow: '0 12px 26px rgba(75,47,214,.35)',
            }}
          >
            <Mail className="size-8" />
          </div>

          <h1 className="text-[30px] font-extrabold text-[#0E0E1A]">{t('auth.verify.title')}</h1>
          <p className="text-[15px] text-[#4B4B5C]">
            {t('auth.verify.subtitleDesktopPrefix')} <strong className="text-[#0E0E1A]">{email}</strong>
          </p>

          <form onSubmit={handleManualSubmit} className="flex w-full flex-col items-center gap-[22px]">
            <OtpInput
              length={CODE_LENGTH}
              value={code}
              onChange={handleCodeChange}
              onComplete={handleComplete}
              error={codeError}
              disabled={isVerifying}
              legend={t('auth.verify.legend')}
              legendClassName="sr-only"
              containerClassName="justify-center gap-2.5"
              boxClassName="h-16 w-16 rounded-[18px] text-[26px]"
            />
            {codeErrorMessage ? (
              <p role="alert" className="text-sm font-semibold text-[#A3213A]">
                {codeErrorMessage}
              </p>
            ) : null}
            <SubmitButton isSubmitting={isVerifying} idleLabel={t('auth.verify.submitIdle')} busyLabel={t('auth.verify.submitBusy')} className="w-full" />
          </form>

          {resendText('text-[#4B4B5C]')}

          <Link
            href={backHref}
            className="rounded-[10px] px-2.5 py-2.5 text-sm font-semibold text-[#4B4B5C]"
          >
            {t('auth.verify.editEmail')}
          </Link>
        </div>
      </div>

      {/* ============================= MOBILE (< 768px / md) ============================= */}
      <div
        className="flex min-h-[100dvh] flex-col gap-7 bg-[#F3F3F7] px-6 md:hidden"
        style={{
          paddingTop: 'calc(56px + env(safe-area-inset-top))',
          paddingBottom: 'calc(36px + env(safe-area-inset-bottom))',
        }}
      >
        <Link
          href={backHref}
          aria-label={t('auth.verify.back')}
          className="flex size-11 items-center justify-center rounded-full border border-[#ECECF2] bg-white"
        >
          <ArrowLeft className="size-5 text-[#0E0E1A]" />
        </Link>

        <div className="flex flex-col items-start gap-3">
          <div className="flex size-16 items-center justify-center rounded-[20px] bg-[#EEEAFE] text-[#5B3FE6]">
            <Mail className="size-7" />
          </div>
          <h1 className="text-[30px] font-bold leading-[1.1] text-[#0E0E1A]">{t('auth.verify.title')}</h1>
          <p className="text-[15px] text-[#6B6B7B]">
            {t('auth.verify.subtitleMobilePrefix')} {email}
          </p>
        </div>

        <form onSubmit={handleManualSubmit} className="flex flex-1 flex-col gap-5">
          <div>
            <OtpInput
              length={CODE_LENGTH}
              value={code}
              onChange={handleCodeChange}
              onComplete={handleComplete}
              error={codeError}
              disabled={isVerifying}
              legend={t('auth.verify.legend')}
              legendClassName="mb-2.5 block text-[13px] font-semibold text-[#0E0E1A]"
              containerClassName="gap-2"
              boxClassName="h-[58px] w-[46px] rounded-[14px] text-2xl"
            />
            {codeErrorMessage ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-[#A3213A]">
                {codeErrorMessage}
              </p>
            ) : null}
          </div>

          {resendText('text-[#6B6B7B]')}

          <div className="flex-1" />

          <SubmitButton isSubmitting={isVerifying} idleLabel={t('auth.verify.submitIdle')} busyLabel={t('auth.verify.submitBusy')} />
        </form>
      </div>
    </>
  )
}

export default function VerifyPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyPageInner />
    </React.Suspense>
  )
}
