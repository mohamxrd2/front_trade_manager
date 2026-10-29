import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Team · Waelly' : 'Équipe · Waelly' }
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
