import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Inventory · Waelly' : 'Stock · Waelly' }
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
