import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Préférences · Waelly',
}

export default function OnboardingPreferencesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
