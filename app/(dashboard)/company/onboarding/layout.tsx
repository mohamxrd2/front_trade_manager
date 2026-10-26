import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Company · Waelly' : 'Entreprise · Waelly' }
}

export default function CompanyOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
