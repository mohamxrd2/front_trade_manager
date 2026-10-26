import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Invoices · Waelly' : 'Factures · Waelly' }
}

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
