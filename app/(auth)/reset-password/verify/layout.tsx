import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'
import { translate } from '@/lib/i18n/translate'

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate('auth.forgot.metaTitle', await resolveInitialLanguage()) }
}

export default function ResetVerifyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
