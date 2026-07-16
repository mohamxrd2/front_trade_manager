'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

// Durée du cooldown avant de pouvoir renvoyer un nouveau code (anti-spam)
const RESEND_COOLDOWN_MS = 45_000

function verifyExpiryStorageKey(email: string) {
  return `verify_code_expires_at:${email}`
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export interface VerifyCodeScreenProps {
  className?: string
  /** Email pour lequel un code de vérification a été envoyé */
  email: string
  /** Durée de validité du code reçue à l'entrée sur cet écran (secondes) */
  expiresIn: number
  /** Bandeau informatif optionnel au-dessus du champ code (ex: contexte différent de l'inscription) */
  infoMessage?: string
  /** "Ce n'est pas votre email ? Modifier", ou renvoi vers l'appelant sur 404 (plus d'inscription/vérification en attente) */
  onBack: (message?: string) => void
}

/**
 * Écran de saisie du code de vérification à 5 chiffres, partagé entre
 * l'inscription (POST /register en attente) et la connexion bloquée par
 * un email non vérifié (403 EMAIL_NOT_VERIFIED) — les deux cas appellent
 * le même endpoint POST /api/register/verify.
 */
export function VerifyCodeScreen({ className, email, expiresIn, infoMessage, onBack }: VerifyCodeScreenProps) {
  const { verifyRegistration, resendRegistrationCode } = useAuth()

  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [isLocked, setIsLocked] = useState(false) // code expiré / trop de tentatives : bloqué jusqu'au renvoi
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  const [resendRemainingMs, setResendRemainingMs] = useState(0)

  // Initialisation : reprendre le compte à rebours persisté pour cet email
  // (ex: refresh de page) sinon partir de la durée reçue en prop.
  useEffect(() => {
    if (!email || typeof window === 'undefined') return

    const stored = window.sessionStorage.getItem(verifyExpiryStorageKey(email))
    const storedExpiresAt = stored ? Number(stored) : NaN

    if (!Number.isNaN(storedExpiresAt) && storedExpiresAt > Date.now()) {
      setExpiresAt(storedExpiresAt)
    } else {
      const initialExpiresAt = Date.now() + expiresIn * 1000
      window.sessionStorage.setItem(verifyExpiryStorageKey(email), String(initialExpiresAt))
      setExpiresAt(initialExpiresAt)
    }

    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
    setResendRemainingMs(RESEND_COOLDOWN_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // Compte à rebours d'expiration du code
  useEffect(() => {
    if (expiresAt === null) return

    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  // Compte à rebours du cooldown "Renvoyer le code"
  useEffect(() => {
    if (resendAvailableAt === null) return

    const tick = () => setResendRemainingMs(Math.max(0, resendAvailableAt - Date.now()))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [resendAvailableAt])

  const isExpired = remainingMs === 0
  const canResend = resendRemainingMs === 0
  const isCodeInputLocked = isLocked || isExpired

  const handleVerify = useCallback(async () => {
    if (code.length !== 5 || isVerifying || isCodeInputLocked) return

    setIsVerifying(true)
    setVerifyError('')

    try {
      const result = await verifyRegistration({ email, code })

      if (result.success) {
        // La redirection vers le dashboard est gérée par AuthContext
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(verifyExpiryStorageKey(email))
        }
        return
      }

      if (result.status === 404) {
        // Aucune vérification en attente pour cet email (ex: trop longtemps après)
        onBack(result.error || 'Votre demande de vérification est introuvable. Merci de recommencer.')
        return
      }

      if (result.status === 410 || result.status === 429) {
        // Code expiré ou trop de tentatives : bloqué jusqu'au renvoi
        setIsLocked(true)
      }

      setVerifyError(result.error || 'Code invalide')
      setCode('')
    } catch (error) {
      // Filet de sécurité : verifyRegistration() ne devrait jamais rejeter
      // (elle catch tout en interne), mais cette fonction est appelée en
      // fire-and-forget (onClick direct, useEffect d'auto-soumission) — sans
      // ce catch, une exception ici deviendrait une promesse rejetée non
      // gérée et ferait planter l'app au lieu d'afficher une erreur propre.
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 [VerifyCodeScreen] handleVerify: erreur inattendue', error)
      }
      setVerifyError('Une erreur inattendue s\'est produite. Réessaie.')
      setCode('')
    } finally {
      setIsVerifying(false)
    }
  }, [code, isVerifying, isCodeInputLocked, email, verifyRegistration, onBack])

  // Auto-soumission dès que les 5 chiffres sont saisis
  useEffect(() => {
    if (code.length === 5 && !isVerifying && !isCodeInputLocked) {
      handleVerify()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const handleResend = async () => {
    if (!canResend || isResending) return

    setIsResending(true)
    setVerifyError('')

    try {
      const result = await resendRegistrationCode(email)

      if (result.success && result.expiresIn) {
        const newExpiresAt = Date.now() + result.expiresIn * 1000
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(verifyExpiryStorageKey(email), String(newExpiresAt))
        }
        setExpiresAt(newExpiresAt)
        setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS)
        setResendRemainingMs(RESEND_COOLDOWN_MS)
        setIsLocked(false)
        setCode('')
      } else if (result.status === 404) {
        onBack(result.error || 'Votre demande de vérification est introuvable. Merci de recommencer.')
      } else {
        setVerifyError(result.error || 'Erreur lors du renvoi du code')
      }
    } catch (error) {
      // Même filet de sécurité que handleVerify : appelé en onClick direct,
      // ne doit jamais laisser échapper une promesse rejetée non gérée.
      if (process.env.NODE_ENV !== 'production') {
        console.error('🚨 [VerifyCodeScreen] handleResend: erreur inattendue', error)
      }
      setVerifyError('Une erreur inattendue s\'est produite. Réessaie.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 max-w-md mx-auto w-full", className)}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0">
          <div className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Vérifie ton email</h1>
                <p className="text-muted-foreground text-balance">
                  On a envoyé un code à 5 chiffres à{' '}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              {infoMessage && (
                <Field>
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-600 dark:text-blue-400">{infoMessage}</p>
                  </div>
                </Field>
              )}

              {verifyError && (
                <Field>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">{verifyError}</p>
                  </div>
                </Field>
              )}

              {isCodeInputLocked && !verifyError && (
                <Field>
                  <div className="rounded-md bg-orange-50 dark:bg-orange-900/20 p-4 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      Ton code a expiré. Clique sur &quot;Renvoyer le code&quot; pour en recevoir un nouveau.
                    </p>
                  </div>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="code">Code de vérification</FieldLabel>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  disabled={isVerifying || isCodeInputLocked}
                  maxLength={5}
                  className="text-center text-2xl tracking-[0.5em] font-semibold"
                />
                <FieldDescription className="text-center text-xs">
                  {isExpired
                    ? 'Code expiré'
                    : remainingMs !== null
                      ? `Expire dans ${formatDuration(remainingMs)}`
                      : null}
                </FieldDescription>
              </Field>

              <Field>
                <Button
                  type="button"
                  variant="default"
                  className="w-full"
                  onClick={handleVerify}
                  disabled={isVerifying || isCodeInputLocked || code.length !== 5}
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    'Vérifier le code'
                  )}
                </Button>
              </Field>

              <Field>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResend}
                  disabled={isResending || !canResend}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : canResend ? (
                    'Renvoyer le code'
                  ) : (
                    `Renvoyer le code (${formatDuration(resendRemainingMs)})`
                  )}
                </Button>
              </Field>

              <FieldDescription className="text-center">
                <button
                  type="button"
                  onClick={() => onBack()}
                  className="underline-offset-2 hover:underline text-sm text-muted-foreground"
                >
                  Ce n&apos;est pas votre email ? Modifier
                </button>
              </FieldDescription>
            </FieldGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
