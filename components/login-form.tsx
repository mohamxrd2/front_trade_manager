'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  import Image from 'next/image'
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
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
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

  return (
    <div className={cn("flex flex-col gap-6 max-w-4xl mx-auto w-full", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.preventDefault()
                      // TODO: Implémenter la récupération de mot de passe
                    }}
                  >
                    Mot de passe oublié ?
                  </a>
                </div>
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
              
              <Field className="grid grid-cols-3 gap-4">
                <Button variant="outline" type="button" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="sr-only">Login with Apple</span>
                </Button>
                <Button variant="outline" type="button" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="sr-only">Login with Google</span>
                </Button>
                <Button variant="outline" type="button" disabled>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
                      fill="currentColor"
                    />
                  </svg>
                  <span className="sr-only">Login with Meta</span>
                </Button>
              </Field>
              
              <FieldDescription className="text-center">
                Pas encore de compte ? <Link href="/signup" className="underline-offset-2 hover:underline">S&apos;inscrire</Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="bg-muted relative hidden md:block">
            <Image
              src="/"
              alt="Image"
              fill
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              priority
            />
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        En cliquant sur continuer, vous acceptez nos <a href="#" className="underline-offset-2 hover:underline">Conditions d&apos;utilisation</a>{" "}
        et notre <a href="#" className="underline-offset-2 hover:underline">Politique de confidentialité</a>.
      </FieldDescription>
    </div>
  )
}
