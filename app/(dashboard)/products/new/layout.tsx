import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Add an item · Waelly' : 'Ajouter un article · Waelly' }
}

export default function NewProductLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
