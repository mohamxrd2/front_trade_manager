import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Profile · Waelly' : 'Profil · Waelly' }
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
