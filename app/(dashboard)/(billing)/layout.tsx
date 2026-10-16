'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCompanyOnboarding } from '@/hooks/useCompanyOnboarding'

interface BillingLayoutProps {
  children: ReactNode
}

/**
 * Groupe (billing) : /invoices* et /clients. GlassSidebar/BottomTabBar
 * fournissent déjà la navigation entre les deux — ce layout ne fait plus
 * que garder la redirection vers /company/onboarding pour les pages
 * /invoices tant que l'entreprise n'a pas logo + email (l'ancienne barre
 * d'onglets ici était redondante avec le menu latéral et pas dans les
 * maquettes Waelly).
 */
export default function BillingLayout({ children }: BillingLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { status, isLoading } = useCompanyOnboarding()

  useEffect(() => {
    if (!isLoading && status?.needs_onboarding && pathname.startsWith('/invoices')) {
      router.replace('/company/onboarding')
    }
  }, [isLoading, status, pathname, router])

  if (pathname.startsWith('/invoices')) {
    if (isLoading) {
      return <div className="h-40 animate-pulse rounded-panel bg-surface-soft" />
    }
    if (status?.needs_onboarding) {
      return null
    }
  }

  return <>{children}</>
}
