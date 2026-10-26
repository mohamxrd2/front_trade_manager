import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export async function generateMetadata(): Promise<Metadata> {
  const language = await resolveInitialLanguage()
  return { title: language === 'en' ? 'Wallet · Waelly' : 'Portefeuille · Waelly' }
}

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
