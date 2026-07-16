'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { toast } from 'sonner'
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, Building2, MapPin, CheckCircle, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { isSilentError } from '@/lib/utils/error-handler'
import { completeOnboarding, checkOnboarding, type OnboardingData } from '@/lib/services/onboarding'
import { useAuth } from '@/contexts/AuthContext'

// Options pour les secteurs d'activité
const BUSINESS_SECTORS = [
  'Commerce de détail',
  'Commerce de gros',
  'E-commerce',
  'Services',
  'Restauration',
  'Hôtellerie',
  'Transport',
  'Immobilier',
  'Finance',
  'Santé',
  'Éducation',
  'Technologie',
  'Industrie',
  'Agriculture',
  'Autre',
]

// Options pour les statuts juridiques
const LEGAL_STATUSES = [
  'SARL',
  'SA',
  'EURL',
  'SAS',
  'SASU',
  'SNC',
  'SCI',
  'Auto-entrepreneur',
  'Association',
  'Autre',
]

// Schéma de validation
const createOnboardingSchema = (t: (key: string) => string) => z.object({
  // Informations de l'entreprise
  company_name: z.string().min(1, t('onboarding.validation.companyNameRequired')),
  company_sector: z.string().min(1, t('onboarding.validation.sectorRequired')),
  company_headquarters: z.string().min(1, t('onboarding.validation.headquartersRequired')),
  company_email: z.string().email(t('onboarding.validation.invalidEmail')).optional().or(z.literal('')),
  company_legal_status: z.string().min(1, t('onboarding.validation.legalStatusRequired')),
  company_bank_account_number: z.string().optional(),

  // Paramètres
  currency: z.enum(['FCFA', 'EUR', 'USD', 'XOF', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'CAD', 'AUD', 'CHF', 'NGN', 'ZAR', 'EGP']).refine(
    (val) => !!val,
    { message: t('onboarding.validation.currencyRequired') }
  ),
})

type OnboardingFormData = z.infer<ReturnType<typeof createOnboardingSchema>>

const STEPS = [
  {
    id: 1,
    titleKey: 'onboarding.steps.basicInfo.title',
    descriptionKey: 'onboarding.steps.basicInfo.description',
    icon: Building2,
  },
  {
    id: 2,
    titleKey: 'onboarding.steps.contactInfo.title',
    descriptionKey: 'onboarding.steps.contactInfo.description',
    icon: MapPin,
  },
  {
    id: 3,
    titleKey: 'onboarding.steps.finalization.title',
    descriptionKey: 'onboarding.steps.finalization.description',
    icon: CheckCircle,
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)
  const [currentStep, setCurrentStep] = useState(1)
  const [isExplicitSubmit, setIsExplicitSubmit] = useState(false)

  // Mémoriser le schéma pour éviter de le recréer à chaque rendu
  const onboardingSchema = useMemo(() => createOnboardingSchema(t), [t])

  // Tous les Hooks doivent être appelés avant tout return conditionnel
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      currency: 'FCFA',
    },
    mode: 'onChange',
  })

  // Vérifier si l'onboarding est déjà complété au chargement
  useEffect(() => {
    const verifyOnboardingStatus = async () => {
      // Attendre que l'auth soit chargé
      if (authLoading) {
        return
      }

      // Si l'utilisateur n'est pas connecté, rediriger vers login
      if (!user) {
        router.push('/login')
        return
      }

      try {
        // Vérifier si l'onboarding est déjà complété
        const status = await checkOnboarding()
        
        if (status.is_complete) {
          // Si déjà complété, rediriger vers le dashboard
          router.push('/dashboard')
          return
        }
      } catch (error) {
        // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
        if (isSilentError(error)) {
          return
        }

        // Si erreur 404, l'onboarding n'existe pas encore, c'est normal, continuer
        const axiosError = error as { response?: { status?: number } }
        if (axiosError?.response?.status !== 404) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Erreur lors de la vérification de l\'onboarding:', error)
          }
        }
      } finally {
        setCheckingOnboarding(false)
      }
    }

    verifyOnboardingStatus()
  }, [user, authLoading, router])

  // Afficher un loader pendant la vérification
  if (authLoading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Si l'utilisateur n'est pas connecté, ne rien afficher (redirection en cours)
  if (!user) {
    return null
  }

  const totalSteps = STEPS.length
  const progress = (currentStep / totalSteps) * 100

  const nextStep = async () => {
    // Réinitialiser le flag de soumission explicite
    setIsExplicitSubmit(false)
    
    // Valider les champs de l'étape actuelle
    let fieldsToValidate: (keyof OnboardingFormData)[] = []
    
    if (currentStep === 1) {
      fieldsToValidate = ['company_name', 'company_sector', 'company_legal_status']
    } else if (currentStep === 2) {
      fieldsToValidate = ['company_headquarters', 'company_email']
    } else if (currentStep === 3) {
      fieldsToValidate = ['currency']
    }

    const isValid = await trigger(fieldsToValidate)
    
    if (isValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    // Réinitialiser le flag de soumission explicite
    setIsExplicitSubmit(false)
    
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const onSubmit = async (data: OnboardingFormData, event?: React.BaseSyntheticEvent) => {
    // Empêcher la soumission si on n'est pas à la dernière étape
    if (currentStep < totalSteps) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    // Double vérification : s'assurer qu'on est bien à la dernière étape
    if (currentStep !== totalSteps) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    // Vérifier que la soumission est explicite (bouton cliqué)
    if (!isExplicitSubmit) {
      if (event) {
        event.preventDefault()
        event.stopPropagation()
      }
      return
    }

    setIsSubmitting(true)
    try {
      const onboardingData: OnboardingData = {
        company_name: data.company_name,
        company_sector: data.company_sector || null,
        company_headquarters: data.company_headquarters || null,
        company_email: data.company_email || null,
        company_legal_status: data.company_legal_status || null,
        company_bank_account_number: data.company_bank_account_number || null,
        currency: data.currency,
      }

      await completeOnboarding(onboardingData)

      toast.success(t('onboarding.success.title'), {
        description: t('onboarding.success.description'),
      })
      
      // Réinitialiser le flag avant la redirection
      setIsExplicitSubmit(false)
      
      // Rediriger vers le dashboard
      router.push('/dashboard')
    } catch (error: unknown) {
      // Vérifier si c'est une erreur silencieuse (401, redirection, etc.)
      if (isSilentError(error)) {
        // L'intercepteur Axios a déjà géré la redirection, on ne fait rien
        return
      }

      // Vérifier si c'est une erreur 401 non silencieuse
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 401) {
        // Rediriger vers login si ce n'est pas déjà fait
        router.push('/login')
        return
      }

      const errorMessage = error instanceof Error ? error.message : t('errors.loading')
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('Erreur lors de la soumission de l\'onboarding:', error)
      }

      toast.error(t('onboarding.errors.submitFailed'), {
        description: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
      setIsExplicitSubmit(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <Label htmlFor="company_name" className="text-base font-semibold">
                    {t('onboarding.companyInfo.name')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    {...register('company_name')}
                    placeholder={t('onboarding.companyInfo.namePlaceholder')}
                    className="h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20"
                  />
              {errors.company_name && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errors.company_name.message}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <Label htmlFor="company_sector" className="text-base font-semibold">
                {t('onboarding.companyInfo.sector')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('company_sector') || ''}
                onValueChange={(value) => setValue('company_sector', value)}
              >
                <SelectTrigger className="w-full h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder={t('onboarding.companyInfo.sectorPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_SECTORS.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.company_sector && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errors.company_sector.message}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <Label htmlFor="company_legal_status" className="text-base font-semibold">
                {t('onboarding.companyInfo.legalStatus')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('company_legal_status') || ''}
                onValueChange={(value) => setValue('company_legal_status', value)}
              >
                <SelectTrigger className="w-full h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder={t('onboarding.companyInfo.legalStatusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {LEGAL_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.company_legal_status && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errors.company_legal_status.message}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <Label htmlFor="company_headquarters" className="text-base font-semibold">
                {t('onboarding.companyInfo.headquarters')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_headquarters"
                {...register('company_headquarters')}
                placeholder={t('onboarding.companyInfo.headquartersPlaceholder')}
                className="h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20"
              />
              {errors.company_headquarters && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errors.company_headquarters.message}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <Label htmlFor="company_email" className="text-base font-semibold">
                {t('onboarding.companyInfo.email')}
              </Label>
              <Input
                id="company_email"
                type="email"
                {...register('company_email')}
                placeholder={t('onboarding.companyInfo.emailPlaceholder')}
                className="h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20"
              />
              {errors.company_email && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errors.company_email.message}
                </motion.p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <Label htmlFor="company_bank_account_number" className="text-base font-semibold">
                {t('onboarding.companyInfo.bankAccount')}
              </Label>
              <Input
                id="company_bank_account_number"
                {...register('company_bank_account_number')}
                placeholder={t('onboarding.companyInfo.bankAccountPlaceholder')}
                className="h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20"
              />
            </motion.div>
          </motion.div>
        )

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <Label htmlFor="currency" className="text-base font-semibold">
                {t('onboarding.settings.currency')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('currency')}
                onValueChange={(value) => setValue('currency', value as 'FCFA' | 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CNY' | 'INR' | 'BRL' | 'CAD' | 'AUD' | 'CHF' | 'NGN' | 'ZAR' | 'EGP')}
              >
                <SelectTrigger className="w-full h-12 text-base transition-all duration-200 focus:scale-[1.01] focus:ring-2 focus:ring-primary/20">
                  <SelectValue placeholder={t('onboarding.settings.currencyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FCFA">FCFA ({t('onboarding.settings.currencies.FCFA')})</SelectItem>
                  <SelectItem value="EUR">EUR ({t('onboarding.settings.currencies.EUR')})</SelectItem>
                  <SelectItem value="USD">USD ({t('onboarding.settings.currencies.USD')})</SelectItem>
          
                  <SelectItem value="GBP">GBP ({t('onboarding.settings.currencies.GBP')})</SelectItem>
                  <SelectItem value="JPY">JPY ({t('onboarding.settings.currencies.JPY')})</SelectItem>
                  <SelectItem value="CNY">CNY ({t('onboarding.settings.currencies.CNY')})</SelectItem>
                  <SelectItem value="INR">INR ({t('onboarding.settings.currencies.INR')})</SelectItem>
                  <SelectItem value="BRL">BRL ({t('onboarding.settings.currencies.BRL')})</SelectItem>
                  <SelectItem value="CAD">CAD ({t('onboarding.settings.currencies.CAD')})</SelectItem>
                  <SelectItem value="AUD">AUD ({t('onboarding.settings.currencies.AUD')})</SelectItem>
                  <SelectItem value="CHF">CHF ({t('onboarding.settings.currencies.CHF')})</SelectItem>
                  <SelectItem value="NGN">NGN ({t('onboarding.settings.currencies.NGN')})</SelectItem>
                  <SelectItem value="ZAR">ZAR ({t('onboarding.settings.currencies.ZAR')})</SelectItem>
                  <SelectItem value="EGP">EGP ({t('onboarding.settings.currencies.EGP')})</SelectItem>
                </SelectContent>
              </Select>
              {errors.currency && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {errors.currency.message}
                </motion.p>
              )}
            </motion.div>

          </motion.div>
        )

      default:
        return null
    }
  }

  const currentStepData = STEPS[currentStep - 1]
  const IconComponent = currentStepData.icon

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl animate-pulse delay-2000" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl"
        >
          {/* Header Section */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 mb-6"
            >
              <IconComponent className="h-10 w-10 text-primary-foreground" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              {t(currentStepData.titleKey)}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              {t(currentStepData.descriptionKey)}
            </motion.p>
          </div>

          {/* Progress Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <div className="flex justify-between items-center mb-3 px-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t('onboarding.step')} {currentStep} {t('common.of')} {totalSteps}
              </span>
              <span className="text-sm font-semibold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/90 to-primary rounded-full shadow-lg"
              />
            </div>
          </motion.div>

          {/* Step Indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center items-center gap-4 mb-12"
          >
            {STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id
              
              return (
                <div key={step.id} className="flex items-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.7 + index * 0.1, type: 'spring' }}
                    className={`
                      relative flex items-center justify-center w-14 h-14 rounded-xl border-2 transition-all duration-300
                      ${isActive 
                        ? 'border-primary bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 scale-110' 
                        : ''
                      }
                      ${isCompleted 
                        ? 'border-primary bg-gradient-to-br from-primary/80 to-primary/60 text-primary-foreground shadow-md' 
                        : 'border-muted-foreground/30 bg-muted/50'
                      }
                      ${!isActive && !isCompleted 
                        ? 'bg-muted/30' 
                        : ''
                      }
                    `}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <StepIcon className={`h-6 w-6 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    )}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-xl bg-primary/20"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                  {index < STEPS.length - 1 && (
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.8 + index * 0.1 }}
                      className={`
                        w-16 h-1 mx-3 rounded-full transition-all duration-300
                        ${isCompleted 
                          ? 'bg-gradient-to-r from-primary to-primary/60' 
                          : 'bg-muted-foreground/20'
                        }
                      `}
                    />
                  )}
                </div>
              )
            })}
          </motion.div>

          {/* Form Container */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-background/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/50 p-8 md:p-12"
          >
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                
                // Ne soumettre que si on est à la dernière étape ET que le bouton submit a été cliqué explicitement
                if (currentStep === totalSteps && isExplicitSubmit) {
                  handleSubmit(onSubmit)(e)
                } else {
                  // Si ce n'est pas une soumission explicite, ne rien faire
                  return
                }
              }}
              onKeyDown={(e) => {
                // Empêcher la soumission avec Entrée sauf si on est à la dernière étape
                if (e.key === 'Enter') {
                  if (currentStep < totalSteps) {
                    e.preventDefault()
                    e.stopPropagation()
                    // Au lieu de soumettre, passer à l'étape suivante
                    nextStep()
                  } else {
                    // À la dernière étape, permettre la soumission seulement si on appuie explicitement sur Entrée
                    // Mais on va quand même prévenir le comportement par défaut pour être sûr
                    e.preventDefault()
                    e.stopPropagation()
                  }
                }
              }}
            >
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>

              <div className="flex justify-between gap-4 pt-8 mt-8 border-t border-border/50">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    size="lg"
                    className="min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t('onboarding.previous')}
                  </Button>
                </motion.div>

                {currentStep < totalSteps ? (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      type="button"
                      onClick={nextStep}
                      size="lg"
                      className="min-w-[140px] bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20"
                    >
                      {t('onboarding.next')}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      size="lg"
                      className="min-w-[180px] bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 disabled:opacity-50"
                      onClick={(e) => {
                        // S'assurer qu'on est bien à la dernière étape avant de soumettre
                        if (currentStep !== totalSteps) {
                          e.preventDefault()
                          e.stopPropagation()
                          return
                        }
                        // Marquer que la soumission est explicite
                        setIsExplicitSubmit(true)
                        // Laisser le formulaire se soumettre normalement
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('onboarding.submitting')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t('onboarding.submit')}
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
