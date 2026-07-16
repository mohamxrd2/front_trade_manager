'use client'

import { useState, useRef, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, Building2, Mail, Image as ImageIcon, X, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useCompanyOnboarding, completeOnboarding, type MissingField } from '@/hooks/useCompanyOnboarding'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

export default function CompanyOnboardingPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { status, isLoading: isLoadingStatus, refresh } = useCompanyOnboarding()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Form state
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Redirect if no onboarding needed
  useEffect(() => {
    if (!isLoadingStatus && status && !status.needs_onboarding) {
      router.replace('/invoices')
    }
  }, [isLoadingStatus, status, router])

  // Check if field is missing
  const isMissing = (field: MissingField) => status?.missing_fields.includes(field) ?? false
  const needsLogo = isMissing('logo')
  const needsEmail = isMissing('email')

  // Handle logo upload
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('company.logoTooLarge'))
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('company.logoInvalidType'))
      return
    }

    setLogoFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Validate email
  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setEmailError(t('company.emailRequired'))
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError(t('company.emailInvalid'))
      return false
    }
    setEmailError('')
    return true
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    let isValid = true

    if (needsEmail && !validateEmail(email)) {
      isValid = false
    }

    if (needsLogo && !logoFile) {
      toast.error(t('company.logoRequired'))
      isValid = false
    }

    if (!isValid) return

    setIsSubmitting(true)
    setUploadProgress(0)

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + 10
      })
    }, 200)

    try {
      await completeOnboarding({
        email: needsEmail ? email : undefined,
        logo: needsLogo ? logoFile || undefined : undefined,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      toast.success(t('company.onboardingComplete'))

      // Refresh status and redirect
      await refresh()
      router.push('/invoices')
    } catch (error) {
      clearInterval(progressInterval)
      setUploadProgress(0)

      const err = error as Error & { response?: { data?: { message?: string } } }
      const message = err.response?.data?.message || err.message || t('company.saveError')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoadingStatus) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Already completed
  if (!status?.needs_onboarding) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('company.alreadyComplete')}</h2>
            <p className="text-muted-foreground mb-6">{t('company.redirecting')}</p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">{t('company.completeProfile')}</CardTitle>
          <CardDescription>{t('company.completeProfileDescription')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo Upload - Only if missing */}
            {needsLogo && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {t('company.logo')} <span className="text-destructive">*</span>
                </Label>

                {logoPreview ? (
                  <div className="relative inline-block">
                    <div className="h-32 w-32 rounded-lg border-2 border-green-500 p-2 bg-green-50 dark:bg-green-950/20">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeLogo}
                      disabled={isSubmitting}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => !isSubmitting && fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-lg p-8 text-center transition-colors
                      ${isSubmitting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20'}
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isSubmitting}
                    />
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      {t('company.dragDropLogo')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG, GIF, SVG, WebP (max. 2MB)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Email Input - Only if missing */}
            {needsEmail && (
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {t('company.email')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('company.emailPlaceholder')}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  onBlur={() => validateEmail(email)}
                  className={emailError ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {emailError && (
                  <p className="text-sm text-destructive">{emailError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('company.emailDescription')}
                </p>
              </div>
            )}

            {/* Upload Progress */}
            {isSubmitting && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('company.uploading')}</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('company.continueToInvoices')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

