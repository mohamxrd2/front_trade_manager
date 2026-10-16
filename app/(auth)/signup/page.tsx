'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import {
  AuthLogo,
  AuthInput,
  PasswordInput,
  SocialButtons,
  Divider,
  SubmitButton,
  AuthError,
  AuthSteps,
  AuthStepsCompact,
} from '@/components/auth'

/**
 * Inscription — design/maquettes/ordinateur/Web-Inscription.dc.html
 * (≥ 768px, formulaire à GAUCHE / panneau visuel à DROITE). Pas de maquette
 * mobile : en-tête compact + indicateur d'étapes, même famille visuelle que
 * la Connexion mobile.
 *
 * Écarts assumés (le formulaire n'a ni champ "nom d'utilisateur" ni
 * "confirmer le mot de passe", mais POST /api/register les exige) :
 * - `username` est dérivé automatiquement du nom complet (slug + suffixe
 *   aléatoire) — invisible pour l'utilisateur, modifiable plus tard dans
 *   Paramètres.
 * - `password_confirmation` est silencieusement égal à `password`.
 * - Le mot de passe DOIT satisfaire la politique réelle du backend (8+,
 *   majuscule, minuscule, chiffre, symbole) pour être soumis — la jauge
 *   visuelle ne montre que les 4 critères de la maquette (la minuscule n'est
 *   pas un segment affiché), mais son absence bloque quand même l'envoi
 *   avec un message explicite, pour éviter un 422 surprise après une jauge
 *   qui semblait suffisante.
 */

function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? ''
  const last = parts.slice(1).join(' ')
  // Backend : first_name/last_name requis tous les deux — un nom en un seul
  // mot (rare mais possible) réutilise ce mot pour les deux plutôt que
  // d'envoyer une chaîne vide qui ferait 422.
  return { first_name: first, last_name: last || first }
}

function deriveUsername(fullName: string): string {
  const base =
    fullName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 20) || 'user'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${base}.${suffix}`
}

function passwordScore(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

const SCORE_LABELS: Record<number, string> = {
  0: 'Trop faible',
  1: 'Trop faible',
  2: 'Moyen',
  3: 'Bon mot de passe',
  4: 'Excellent',
}

const signupSchema = z.object({
  fullName: z.string().min(2, 'Le nom complet doit contenir au moins 2 caractères'),
  email: z.string().email('Adresse e-mail invalide'),
  password: z.string().superRefine((val, ctx) => {
    const missing: string[] = []
    if (val.length < 8) missing.push('8 caractères minimum')
    if (!/[A-Z]/.test(val)) missing.push('une majuscule')
    if (!/[a-z]/.test(val)) missing.push('une minuscule')
    if (!/[0-9]/.test(val)) missing.push('un chiffre')
    if (!/[^A-Za-z0-9]/.test(val)) missing.push('un caractère spécial')
    if (missing.length > 0) {
      ctx.addIssue({ code: 'custom', message: `Il manque : ${missing.join(', ')}.` })
    }
  }),
  terms: z.boolean().refine((v) => v === true, { message: 'Vous devez accepter les conditions.' }),
})

type SignupFormValues = z.infer<typeof signupSchema>

function PasswordStrengthGauge({ password }: { password: string }) {
  const score = passwordScore(password)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-[5px] rounded-[3px]', i < score ? 'bg-[#5B3FE6]' : 'bg-[#E2E2EA]')} />
        ))}
      </div>
      <p className="text-xs text-[#4B4B5C]" aria-live="polite">
        {SCORE_LABELS[score]} · 8 caractères minimum
      </p>
    </div>
  )
}

function SignupPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register: registerUser } = useAuth()
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [emailTakenEmail, setEmailTakenEmail] = React.useState<string | null>(null)

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: { fullName: '', email: searchParams.get('email') ?? '', password: '', terms: false },
  })

  const password = watch('password')

  const onSubmit = async (values: SignupFormValues) => {
    setAuthError(null)
    setEmailTakenEmail(null)

    const { first_name, last_name } = splitFullName(values.fullName)
    const username = deriveUsername(values.fullName)

    const result = await registerUser({
      first_name,
      last_name,
      username,
      email: values.email,
      password: values.password,
      password_confirmation: values.password,
    })

    if (result.success && result.email) {
      router.push(`/verify?email=${encodeURIComponent(result.email)}`)
      return
    }

    if (result.errors?.email?.length) {
      setEmailTakenEmail(values.email)
      return
    }

    setAuthError(result.error || 'Une erreur est survenue. Réessayez.')
  }

  const emailTakenNotice = emailTakenEmail ? (
    <p className="text-xs font-semibold text-[#A3213A]">
      Un compte existe déjà avec cet e-mail.{' '}
      <Link href={`/login?email=${encodeURIComponent(emailTakenEmail)}`} className="underline">
        Se connecter
      </Link>
    </p>
  ) : null

  const termsCheckbox = (idPrefix: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${idPrefix}-terms`} className="flex items-start gap-2.5 text-sm leading-[1.45] text-[#0E0E1A]">
        <Controller
          control={control}
          name="terms"
          render={({ field: { value, onChange, ...field } }) => (
            <input
              id={`${idPrefix}-terms`}
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-[#5B3FE6]"
              checked={value}
              onChange={(e) => onChange(e.target.checked)}
              {...field}
            />
          )}
        />
        <span>
          J&apos;accepte les{' '}
          <Link href="/terms" className="font-semibold">
            conditions d&apos;utilisation
          </Link>{' '}
          et la{' '}
          <Link href="/privacy" className="font-semibold">
            politique de confidentialité
          </Link>
        </span>
      </label>
      {errors.terms ? <p className="text-xs font-semibold text-[#A3213A]">{errors.terms.message}</p> : null}
    </div>
  )

  return (
    <>
      {/* ============================= ORDINATEUR (≥ 768px / md) ============================= */}
      <div className="hidden min-h-screen flex-wrap gap-5 bg-[#F3F3F7] p-5 md:flex">
        <div className="flex flex-[1_1_440px] items-center justify-center px-5 py-10">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full max-w-[440px] flex-col gap-4">
            <AuthLogo size={36} className="mb-2" textClassName="text-[#0E0E1A]" />

            <div className="flex flex-col gap-1">
              <h1 className="text-[32px] font-extrabold text-[#0E0E1A]">Créer votre compte</h1>
              <p className="text-[15px] text-[#6B6B7B]">Quelques secondes suffisent.</p>
            </div>

            <AuthError>{authError}</AuthError>

            <SocialButtons />
            <Divider>ou</Divider>

            <Controller
              control={control}
              name="fullName"
              render={({ field }) => (
                <AuthInput
                  label="Nom complet"
                  id="signup-name-desktop"
                  autoComplete="name"
                  error={errors.fullName?.message}
                  {...field}
                />
              )}
            />
            <div className="flex flex-col gap-1.5">
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <AuthInput
                    label="Adresse e-mail"
                    id="signup-email-desktop"
                    type="email"
                    autoComplete="email"
                    error={errors.email?.message}
                    {...field}
                  />
                )}
              />
              {emailTakenNotice}
            </div>
            <div className="flex flex-col gap-2">
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <PasswordInput
                    label="Mot de passe"
                    id="signup-password-desktop"
                    autoComplete="new-password"
                    error={errors.password?.message}
                    {...field}
                  />
                )}
              />
              <PasswordStrengthGauge password={password} />
            </div>

            {termsCheckbox('signup-desktop')}

            <SubmitButton isSubmitting={isSubmitting} idleLabel="Créer mon compte" busyLabel="Création…" />

            <p className="text-center text-sm text-[#6B6B7B]">
              Déjà inscrit ?{' '}
              <Link href="/login" className="font-bold text-[#0E0E1A]">
                Se connecter
              </Link>
            </p>
          </form>
        </div>

        <div
          className="flex min-h-[560px] flex-[1_1_480px] flex-col items-center justify-center gap-7 rounded-[32px] p-11 text-white"
          style={{ background: 'linear-gradient(160deg, #5B3FE6 0%, #7A5CF5 55%, #C8B8FF 100%)' }}
        >
          <h2 className="max-w-[480px] text-center text-[clamp(28px,3vw,40px)] font-extrabold leading-[1.1]">
            Votre boutique organisée dès aujourd&apos;hui.
          </h2>
          <AuthSteps current={1} />
        </div>
      </div>

      {/* ============================= MOBILE (< 768px / md) — aucune maquette dédiée ============================= */}
      <div className="flex min-h-screen flex-col bg-[#F3F3F7] md:hidden">
        <div
          className="flex flex-col gap-6 rounded-b-[32px] px-6 pb-7 text-white"
          style={{
            paddingTop: 'calc(64px + env(safe-area-inset-top))',
            background: 'linear-gradient(160deg, #5B3FE6 0%, #7A5CF5 55%, #C8B8FF 100%)',
          }}
        >
          <AuthLogo size={40} textClassName="text-white" />
          <h1 className="text-[28px] font-bold leading-[1.1]">Créer votre compte</h1>
          <AuthStepsCompact current={1} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-6">
          <AuthError>{authError}</AuthError>

          <Controller
            control={control}
            name="fullName"
            render={({ field }) => (
              <AuthInput
                label="Nom complet"
                id="signup-name-mobile"
                autoComplete="name"
                error={errors.fullName?.message}
                {...field}
              />
            )}
          />
          <div className="flex flex-col gap-1.5">
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <AuthInput
                  label="Adresse e-mail"
                  id="signup-email-mobile"
                  type="email"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...field}
                />
              )}
            />
            {emailTakenNotice}
          </div>
          <div className="flex flex-col gap-2">
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <PasswordInput
                  label="Mot de passe"
                  id="signup-password-mobile"
                  autoComplete="new-password"
                  error={errors.password?.message}
                  {...field}
                />
              )}
            />
            <PasswordStrengthGauge password={password} />
          </div>

          {termsCheckbox('signup-mobile')}

          <SubmitButton isSubmitting={isSubmitting} idleLabel="Créer mon compte" busyLabel="Création…" className="mt-1" />

          <Divider>ou</Divider>
          <SocialButtons />

          <p className="text-center text-sm text-[#6B6B7B]">
            Déjà inscrit ?{' '}
            <Link href="/login" className="font-bold text-[#0E0E1A]">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </>
  )
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={null}>
      <SignupPageInner />
    </React.Suspense>
  )
}
