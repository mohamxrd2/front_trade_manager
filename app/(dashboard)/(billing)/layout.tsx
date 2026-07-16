'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompanyOnboarding } from '@/hooks/useCompanyOnboarding'
import { useTranslation } from '@/lib/i18n/hooks/useTranslation'

interface BillingLayoutProps {
  children: ReactNode
}

export default function BillingLayout({ children }: BillingLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { status, isLoading } = useCompanyOnboarding()

  // Redirect to onboarding if needed (for invoice pages only)
  useEffect(() => {
    if (!isLoading && status?.needs_onboarding && pathname.startsWith('/invoices')) {
      router.replace('/company/onboarding')
    }
  }, [isLoading, status, pathname, router])

  // Show loading while checking onboarding status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // Block invoice pages if onboarding needed
  if (status?.needs_onboarding && pathname.startsWith('/invoices')) {
    return null
  }

  const tabs = [
    {
      label: t('nav.clients'),
      href: '/clients',
      icon: Users,
      isActive: pathname.startsWith('/clients'),
    },
    {
      label: t('nav.invoices'),
      href: '/invoices',
      icon: FileText,
      isActive: pathname.startsWith('/invoices'),
      requiresOnboarding: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="border-b">
        <nav className="flex gap-4" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isDisabled = tab.requiresOnboarding && status?.needs_onboarding

            if (isDisabled) {
              return (
                <div
                  key={tab.href}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                  title={t('invoices.onboardingRequired')}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </div>
              )
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors hover:text-foreground',
                  tab.isActive
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Page Content */}
      {children}
    </div>
  )
}

