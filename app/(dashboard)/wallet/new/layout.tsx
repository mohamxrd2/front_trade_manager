import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'New transaction · Waelly' : 'Nouvelle opération · Waelly' }
}

export default function NewTransactionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
