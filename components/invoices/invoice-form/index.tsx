'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, User, Package, Calculator, MapPin, Palette, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { createInvoice, type CreateInvoicePayload } from '@/lib/services/invoices'
import { InvoiceFormProvider, useInvoiceForm } from './invoice-form-context'
import { StepClient } from './step-client'
import { StepItems } from './step-items'
import { StepTotals } from './step-totals'
import { StepAddress } from './step-address'
import { StepTheme } from './step-theme'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

// ============================================================================
// STEPS CONFIG
// ============================================================================

const steps = [
  { id: 1, icon: User, title: 'invoices.steps.client' },
  { id: 2, icon: Package, title: 'invoices.steps.items' },
  { id: 3, icon: Calculator, title: 'invoices.steps.totals' },
  { id: 4, icon: MapPin, title: 'invoices.steps.address' },
  { id: 5, icon: Palette, title: 'invoices.steps.theme' },
]

// ============================================================================
// INNER FORM COMPONENT
// ============================================================================

function InvoiceFormInner() {
  const router = useRouter()
  const { t } = useTranslation()
  const { formData, currentStep, setCurrentStep, canProceed, isLastStep } = useInvoiceForm()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Garde synchrone contre le double-submit : `isSubmitting` (state React) ne
  // suffit pas seul, car un second clic/Entrée peut arriver avant que React
  // n'ait committé le re-render qui désactive le bouton — un ref est lu/écrit
  // immédiatement, sans attendre un cycle de rendu.
  const isSubmittingRef = useRef(false)

  const progress = (currentStep / steps.length) * 100

  const handleNext = () => {
    if (canProceed && currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    // Un seul appel POST /api/invoices en vol à la fois, même si handleSubmit
    // est ré-invoqué plusieurs fois avant le premier re-render (double clic,
    // double-tap mobile, Entrée maintenue sur le bouton focus).
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      // Validation: client requis
      if (!formData.client) {
        toast.error(t('invoices.clientRequired'))
        return
      }

      // Validation: au moins un article valide
      const validItems = formData.items.filter((item) => item.article !== null && item.quantity > 0)
      if (validItems.length === 0) {
        toast.error(t('invoices.noItemsError'))
        return
      }

      setIsSubmitting(true)

      const payload: CreateInvoicePayload = {
        client_id: formData.client.id,
        items: validItems.map((item) => ({
          article_id: String(item.article!.id),
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent || 0,
        })),
        discount_percent: formData.discountType === 'percentage' ? formData.discountValue : 0,
        tax_percent: formData.taxRate,
        shipping_fee: formData.shippingFee,
        billing_address: formData.billingAddress || undefined,
        shipping_address: formData.shippingAddress || undefined,
        notes: formData.notes || undefined,
        terms: formData.terms || undefined,
        due_date: formData.dueDate || new Date().toISOString().split('T')[0],
        theme: formData.theme,
        status: 'unpaid',
      }

      // Debug logs
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Invoice] Payload sent:', payload)
      }

      const invoice = await createInvoice(payload)
      toast.success(t('invoices.invoiceCreated'))
      router.push(`/invoices/${invoice.id}`)
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: Record<string, unknown> }
        message?: string
      }
      const status = axiosError.response?.status
      const data = axiosError.response?.data

      // Debug logs
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Invoice] Status:', status)
        console.log('[Invoice] Response:', data)
      }

      // ❌ Erreur 422 - Validation
      if (status === 422) {
        // Erreurs de stock (tableau de strings)
        if (Array.isArray(data?.errors)) {
          (data.errors as string[]).forEach((err: string) => {
            toast.error(err)
          })
          return
        }

        // Erreurs de validation (objet { field: [messages] })
        if (data?.errors && typeof data.errors === 'object') {
          const firstError = Object.values(data.errors as Record<string, unknown>)[0]
          toast.error(Array.isArray(firstError) ? (firstError as string[])[0] : String(firstError))
          return
        }

        // Message générique de validation
        if (data?.message) {
          toast.error(data.message as string)
          return
        }

        toast.error(t('invoices.validationError'))
        return
      }

      // ❌ Erreur 403 - Company incomplète
      if (status === 403) {
        if (data?.code === 'COMPANY_INCOMPLETE') {
          toast.error(t('invoices.companyIncomplete'))
          router.push('/company/onboarding')
          return
        }
        toast.error((data?.message as string) || t('invoices.accessDenied'))
        return
      }

      // ❌ Erreur 404 - Client ou article non trouvé
      if (status === 404) {
        toast.error((data?.message as string) || t('invoices.notFound'))
        return
      }

      // ❌ Erreur 401 - Non authentifié
      if (status === 401) {
        toast.error(t('errors.unauthorized'))
        router.push('/login')
        return
      }

      // ❌ Erreur 500+ - Erreur serveur
      if (status && status >= 500) {
        console.error('[Invoice] Server error:', data)
        toast.error(t('invoices.serverError'))
        return
      }

      // ❌ Autres erreurs
      const message = (data?.message as string) || (data?.error as string) || axiosError.message || t('invoices.createError')
      toast.error(message)
      console.error('[Invoice] Create error:', error)
    } finally {
      setIsSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  // Render current step content
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepClient />
      case 2:
        return <StepItems />
      case 3:
        return <StepTotals />
      case 4:
        return <StepAddress />
      case 5:
        return <StepTheme />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="py-4">
          <div className="space-y-4">
            {/* Progress bar */}
            <Progress value={progress} className="h-2" />

            {/* Steps indicators */}
            <div className="flex justify-between">
              {steps.map((step) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id

                return (
                  <button
                    key={step.id}
                    onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                    disabled={step.id > currentStep}
                    className={cn(
                      'flex flex-col items-center gap-1 transition-all',
                      step.id < currentStep && 'cursor-pointer',
                      step.id > currentStep && 'cursor-not-allowed opacity-50'
                    )}
                  >
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center transition-colors',
                        isActive && 'bg-green-500 text-white',
                        isCompleted && 'bg-green-500/20 text-green-600',
                        !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium hidden sm:block',
                        isActive && 'text-green-600',
                        !isActive && 'text-muted-foreground'
                      )}
                    >
                      {t(step.title)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t(steps[currentStep - 1].title)}</CardTitle>
        </CardHeader>
        <CardContent>{renderStep()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 1 || isSubmitting}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('common.previous')}
        </Button>

        {isLastStep ? (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed || isSubmitting}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('common.creating')}
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t('invoices.createInvoice')}
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
          >
            {t('common.next')}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export function InvoiceForm() {
  return (
    <InvoiceFormProvider>
      <InvoiceFormInner />
    </InvoiceFormProvider>
  )
}

