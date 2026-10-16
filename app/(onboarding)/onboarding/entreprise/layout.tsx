import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Votre entreprise · Waelly',
}

export default function OnboardingCompanyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
