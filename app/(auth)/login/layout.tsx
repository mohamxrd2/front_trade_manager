import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Log in · Waelly' : 'Connexion · Waelly' }
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
