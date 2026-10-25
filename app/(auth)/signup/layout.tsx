import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Create an account · Waelly' : 'Créer un compte · Waelly' }
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
