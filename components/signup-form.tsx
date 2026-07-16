'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth, type RegisterData } from '@/contexts/AuthContext'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { GoogleAuthButton, FacebookAuthButton } from '@/components/auth/social-auth-buttons'
import { VerifyCodeScreen } from '@/components/auth/verify-code-screen'

/**
 * Schéma de validation Zod pour le formulaire d'inscription
 */
const signupSchema = z.object({
  first_name: z
    .string()
    .min(1, 'Le prénom est requis')
    .min(2, 'Le prénom doit contenir au moins 2 caractères'),
  last_name: z
    .string()
    .min(1, 'Le nom est requis')
    .min(2, 'Le nom doit contenir au moins 2 caractères'),
  username: z
    .string()
    .min(1, 'Le nom d\'utilisateur est requis')
    .min(3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères')
    .regex(/^[a-zA-Z0-9_]+$/, 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'),
  email: z
    .string()
    .min(1, 'L\'email est requis')
    .email('L\'email doit être valide'),
  password: z
    .string()
    .min(1, 'Le mot de passe est requis')
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une lettre majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une lettre minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Le mot de passe doit contenir au moins un symbole (!@#$%^&* etc.)'),
  password_confirmation: z
    .string()
    .min(1, 'La confirmation du mot de passe est requise'),
  company_share: z
    .number()
    .min(0, 'La part de l\'entreprise doit être entre 0 et 100')
    .max(100, 'La part de l\'entreprise doit être entre 0 et 100'),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Vous devez accepter les conditions d\'utilisation',
    }),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['password_confirmation'],
})

type SignupFormData = z.infer<typeof signupSchema>

const DEFAULT_CODE_TTL_SECONDS = 600

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { register: registerUser } = useAuth()

  // ==========================================================================
  // ÉTAPE 1/2 — Formulaire d'inscription (infos + mot de passe)
  // ==========================================================================
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    symbol: false
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange', // nécessaire pour que isValid se recalcule en direct (pas juste au submit)
    defaultValues: {
      first_name: '',
      last_name: '',
      username: '',
      email: '',
      password: '',
      password_confirmation: '',
      company_share: 100,
      acceptTerms: false,
    },
  })

  const password = watch('password')

  useEffect(() => {
    if (password) {
      setPasswordValidation({
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
      })
    } else {
      setPasswordValidation({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        symbol: false
      })
    }
  }, [password])

  // ==========================================================================
  // ÉTAPE 2/2 — Vérification du code reçu par email (composant partagé,
  // aussi utilisé par login-form.tsx pour le cas EMAIL_NOT_VERIFIED)
  // ==========================================================================
  const [step, setStep] = useState<'form' | 'verify'>(() =>
    searchParams.get('step') === 'verify' && searchParams.get('email') ? 'verify' : 'form'
  )
  const [pendingEmail, setPendingEmail] = useState(() => searchParams.get('email') || '')
  const [pendingExpiresIn, setPendingExpiresIn] = useState(DEFAULT_CODE_TTL_SECONDS)

  const goToVerifyStep = useCallback((email: string, expiresInSeconds: number) => {
    setPendingEmail(email)
    setPendingExpiresIn(expiresInSeconds)
    setStep('verify')
    router.replace(`/signup?step=verify&email=${encodeURIComponent(email)}`)
  }, [router])

  const backToForm = useCallback((message?: string) => {
    setStep('form')
    if (message) setError(message)
    router.replace('/signup')
  }, [router])

  // Fonction de soumission du formulaire d'inscription (étape 1)
  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true)
    setError('')
    setFieldErrors({})

    try {
      const registerData: RegisterData = {
        first_name: data.first_name,
        last_name: data.last_name,
        username: data.username,
        email: data.email,
        password: data.password,
        password_confirmation: data.password_confirmation,
        company_share: data.company_share,
      }

      const result = await registerUser(registerData)

      if (result.success && result.email) {
        goToVerifyStep(result.email, result.expiresIn ?? DEFAULT_CODE_TTL_SECONDS)
      } else {
        if (result.errors) {
          setFieldErrors(result.errors)
        }
        setError(result.error || 'Erreur lors de l\'inscription')
      }
    } catch {
      setError('Une erreur inattendue s\'est produite')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'verify') {
    return (
      <VerifyCodeScreen
        className={className}
        email={pendingEmail}
        expiresIn={pendingExpiresIn}
        onBack={backToForm}
      />
    )
  }

  return (
    <div className={cn("flex flex-col gap-6 max-w-xl mx-auto w-full", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 h-[calc(100vh-8rem)]">
          <ScrollArea className="h-full">
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8">
              <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Créez votre compte</h1>
                <p className="text-muted-foreground text-balance">
                  Rejoignez Trade Manager et commencez votre parcours
                </p>
              </div>

              {error && (
                <Field>
                  <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">{error}</p>
                  </div>
                </Field>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="first_name">Prénom</FieldLabel>
                  <Input
                    id="first_name"
                    type="text"
                    placeholder="John"
                    {...register('first_name')}
                    disabled={isLoading}
                    className={cn(
                      "transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                      (errors.first_name || fieldErrors.first_name) && "border-[#ef4444] focus:ring-[#ef4444]"
                    )}
                  />
                  {errors.first_name && (
                    <FieldDescription className="text-[#ef4444] text-xs mt-1">
                      {errors.first_name.message}
                    </FieldDescription>
                  )}
                  {fieldErrors.first_name && (
                    <FieldDescription className="text-[#ef4444] text-xs mt-1">
                      {fieldErrors.first_name.join(', ')}
                    </FieldDescription>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="last_name">Nom</FieldLabel>
                  <Input
                    id="last_name"
                    type="text"
                    placeholder="Doe"
                    {...register('last_name')}
                    disabled={isLoading}
                    className={cn(
                      "transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                      (errors.last_name || fieldErrors.last_name) && "border-[#ef4444] focus:ring-[#ef4444]"
                    )}
                  />
                  {errors.last_name && (
                    <FieldDescription className="text-[#ef4444] text-xs mt-1">
                      {errors.last_name.message}
                    </FieldDescription>
                  )}
                  {fieldErrors.last_name && (
                    <FieldDescription className="text-[#ef4444] text-xs mt-1">
                      {fieldErrors.last_name.join(', ')}
                    </FieldDescription>
                  )}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="username">Nom d&apos;utilisateur</FieldLabel>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  {...register('username')}
                  disabled={isLoading}
                  className={cn(
                    "transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                    (errors.username || fieldErrors.username) && "border-[#ef4444] focus:ring-[#ef4444]"
                  )}
                />
                {errors.username && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.username.message}
                  </FieldDescription>
                )}
                {fieldErrors.username && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {fieldErrors.username.join(', ')}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  {...register('email')}
                  disabled={isLoading}
                  className={cn(
                    "transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                    (errors.email || fieldErrors.email) && "border-[#ef4444] focus:ring-[#ef4444]"
                  )}
                />
                {errors.email && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.email.message}
                  </FieldDescription>
                )}
                {fieldErrors.email && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {fieldErrors.email.join(', ')}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Entrez votre mot de passe"
                    {...register('password')}
                    disabled={isLoading}
                    className={cn(
                      "pr-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                      (errors.password || fieldErrors.password) && "border-[#ef4444] focus:ring-[#ef4444]"
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>

                {/* Validation dynamique du mot de passe */}
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.length ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={passwordValidation.length ? 'text-green-600' : 'text-gray-500'}>
                        Au moins 8 caractères
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.uppercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={passwordValidation.uppercase ? 'text-green-600' : 'text-gray-500'}>
                        Une lettre majuscule
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.lowercase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={passwordValidation.lowercase ? 'text-green-600' : 'text-gray-500'}>
                        Une lettre minuscule
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.number ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={passwordValidation.number ? 'text-green-600' : 'text-gray-500'}>
                        Un chiffre
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${passwordValidation.symbol ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className={passwordValidation.symbol ? 'text-green-600' : 'text-gray-500'}>
                        Un symbole (!@#$%^&* etc.)
                      </span>
                    </div>
                  </div>
                )}

                <FieldDescription className="text-xs text-muted-foreground">
                  Le mot de passe doit respecter tous les critères ci-dessus.
                </FieldDescription>
                {errors.password && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.password.message}
                  </FieldDescription>
                )}
                {fieldErrors.password && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {fieldErrors.password.join(', ')}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="password_confirmation">Confirmer le mot de passe</FieldLabel>
                <div className="relative">
                  <Input
                    id="password_confirmation"
                    type={showPasswordConfirmation ? 'text' : 'password'}
                    placeholder="Confirmez votre mot de passe"
                    {...register('password_confirmation')}
                    disabled={isLoading}
                    className={cn(
                      "pr-10 transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                      (errors.password_confirmation || fieldErrors.password_confirmation) && "border-[#ef4444] focus:ring-[#ef4444]"
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                    disabled={isLoading}
                  >
                    {showPasswordConfirmation ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                {errors.password_confirmation && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.password_confirmation.message}
                  </FieldDescription>
                )}
                {fieldErrors.password_confirmation && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {fieldErrors.password_confirmation.join(', ')}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <div className="flex items-center space-x-2">
                  <input
                    id="acceptTerms"
                    type="checkbox"
                    {...register('acceptTerms')}
                    disabled={isLoading}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="acceptTerms" className="text-sm text-muted-foreground cursor-pointer">
                    J&apos;accepte les{" "}
                    <a href="#" className="text-primary hover:underline">
                      Conditions d&apos;utilisation
                    </a>{" "}
                    et la{" "}
                    <a href="#" className="text-primary hover:underline">
                      Politique de confidentialité
                    </a>
                  </label>
                </div>
                {errors.acceptTerms && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.acceptTerms.message}
                  </FieldDescription>
                )}
              </Field>

                       <Field>
                         <Button
                           type="submit"
                           variant="default"
                           className="w-full"
                           disabled={isLoading || !isValid}
                         >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création du compte...
                    </>
                  ) : (
                    'Créer un compte'
                  )}
                </Button>
              </Field>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Ou continuer avec
              </FieldSeparator>

              <Field className="grid grid-cols-2 gap-4">
                <GoogleAuthButton />
                <FacebookAuthButton />
              </Field>

              <FieldDescription className="text-center">
                Vous avez déjà un compte ? <Link href="/login" className="underline-offset-2 hover:underline">Se connecter</Link>
              </FieldDescription>
            </FieldGroup>
            </form>
          </ScrollArea>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        En cliquant sur continuer, vous acceptez nos <a href="#" className="underline-offset-2 hover:underline">Conditions d&apos;utilisation</a>{" "}
        et notre <a href="#" className="underline-offset-2 hover:underline">Politique de confidentialité</a>.
      </FieldDescription>
    </div>
  )
}
