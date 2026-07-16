'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
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
import Link from "next/link"
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { getSocialAuthErrorMessage } from '@/lib/services/social-auth'
import { GoogleAuthButton, FacebookAuthButton } from '@/components/auth/social-auth-buttons'
import { VerifyCodeScreen } from '@/components/auth/verify-code-screen'
/**
 * Schéma de validation Zod pour le formulaire de login
 */
const loginSchema = z.object({
  login: z
    .string()
    .min(1, 'L\'email ou le nom d\'utilisateur est requis')
    .min(3, 'L\'email ou le nom d\'utilisateur doit contenir au moins 3 caractères'),
  password: z
    .string()
    .min(1, 'Le mot de passe est requis')
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  remember: z.boolean(),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const searchParams = useSearchParams()

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(() => getSocialAuthErrorMessage(searchParams.get('error')) || '')
  const [isLoading, setIsLoading] = useState(false)

  // Écran de vérification par code, affiché quand le backend renvoie
  // 403 EMAIL_NOT_VERIFIED (identifiants corrects, email pas encore vérifié)
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [pendingEmail, setPendingEmail] = useState('')
  const [pendingExpiresIn, setPendingExpiresIn] = useState(600)

  const { login } = useAuth()
  const router = useRouter()

  // Configuration de react-hook-form avec Zod
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
      remember: false,
    },
  })

  // Fonction de soumission du formulaire (appelée uniquement si la validation réussit)
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError('')

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('🚀 Début de la connexion avec:', {
          login: data.login.trim(),
          passwordLength: data.password.length,
          remember: data.remember
        })
      }

      const result = await login({
        login: data.login.trim(),
        password: data.password,
        remember: data.remember
      })
      
      if (process.env.NODE_ENV !== 'production') {
        console.debug('✅ Résultat de la connexion:', result)
      }

      if (result.emailVerificationRequired) {
        // TEMP DEBUG — à retirer une fois le flow validé en prod
        console.log('🔍 [LoginForm] emailVerificationRequired reçu, bascule vers l\'écran de code:', result.emailVerificationRequired)

        // Identifiants corrects mais email pas encore vérifié : pas un échec
        // de connexion classique, on route vers l'écran de vérification par
        // code (un code vient d'être envoyé par le backend, pas la peine de
        // le redemander immédiatement)
        setPendingEmail(result.emailVerificationRequired.email)
        setPendingExpiresIn(result.emailVerificationRequired.expiresIn)
        setStep('verify')
        return
      }

      if (result.success) {
        // La redirection est gérée par AuthContext (vers onboarding ou dashboard selon l'état)
        if (process.env.NODE_ENV !== 'production') {
          console.debug('✅ Connexion réussie, redirection gérée par AuthContext')
        }
        // Ne pas rediriger ici, AuthContext s'en charge
      } else {
        // Afficher le message d'erreur du backend
        const errorMsg = result.error || 'Erreur de connexion'
        
        // Ne pas logger les erreurs d'identifiants invalides comme des erreurs critiques
        // C'est un cas normal (l'utilisateur a simplement entré de mauvais identifiants)
        if (process.env.NODE_ENV !== 'production') {
          if (errorMsg.toLowerCase().includes('identifiants invalides') || 
              errorMsg.toLowerCase().includes('invalid credentials')) {
            // Utiliser console.debug pour les erreurs d'identifiants (cas normal)
            console.debug('⚠️ Identifiants invalides (cas normal, pas une erreur système)')
          } else {
            // Logger les autres erreurs comme des erreurs critiques
            console.error('❌ Erreur de connexion:', errorMsg)
            console.error('❌ Résultat complet:', result)
          }
        }
        setError(errorMsg)
      }
    } catch (error: unknown) {
      // En cas d'erreur inattendue, afficher un message générique
      const err = error as { message?: string; response?: { data?: { message?: string }; status?: number } }
      let errorMsg = 'Une erreur inattendue s\'est produite'
      
      // Extraire le message d'erreur si disponible
      if (err?.response?.data?.message) {
        errorMsg = err.response.data.message
      } else if (err?.message) {
        errorMsg = err.message
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Erreur inattendue lors de la connexion:', error)
        console.error('❌ Message d\'erreur:', errorMsg)
      }
      
      setError(errorMsg)
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
        infoMessage="Vérifie ton email pour continuer"
        onBack={() => setStep('form')}
      />
    )
  }

  return (
    <div className={cn("flex flex-col gap-6 max-w-md mx-auto w-full", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your Trade Manager account
                </p>
              </div>
              
              {error && String(error).trim() !== '' && (
                <Field>
                  <div 
                    className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border-2 border-red-300 dark:border-red-700 shadow-lg"
                    role="alert"
                    aria-live="assertive"
                  >
                    <div className="flex items-start gap-3">
                      <svg 
                        className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200 whitespace-pre-line break-words">
                          {String(error)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="login">Email ou nom d&apos;utilisateur</FieldLabel>
                <Input
                  id="login"
                  type="text"
                  placeholder="Entrez votre email ou nom d&apos;utilisateur"
                  {...register('login')}
                  disabled={isLoading}
                  className={cn(
                    "transition-all duration-200 focus:ring-2 focus:ring-blue-500",
                    errors.login && "border-[#ef4444] focus:ring-[#ef4444]"
                  )}
                />
                {errors.login && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.login.message}
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
                      errors.password && "border-[#ef4444] focus:ring-[#ef4444]"
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
                {errors.password && (
                  <FieldDescription className="text-[#ef4444] text-xs mt-1">
                    {errors.password.message}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <div className="flex items-center space-x-2">
                  <input
                    id="remember"
                    type="checkbox"
                    {...register('remember')}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <FieldLabel 
                    htmlFor="remember" 
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Se souvenir de moi
                  </FieldLabel>
                </div>
              </Field>

                     <Field>
                       <Button 
                         type="submit" 
                         variant="default"
                         className="w-full"
                         disabled={isLoading}
                       >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connexion en cours...
                    </>
                  ) : (
                    'Se connecter'
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
                Pas encore de compte ? <Link href="/signup" className="underline-offset-2 hover:underline">S&apos;inscrire</Link>
              </FieldDescription>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        En cliquant sur continuer, vous acceptez nos <a href="#" className="underline-offset-2 hover:underline">Conditions d&apos;utilisation</a>{" "}
        et notre <a href="#" className="underline-offset-2 hover:underline">Politique de confidentialité</a>.
      </FieldDescription>
    </div>
  )
}
