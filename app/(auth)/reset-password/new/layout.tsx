import type { Metadata } from 'next'

import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'
import { translate } from '@/lib/i18n/translate'

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate('auth.forgot.metaTitleNew', await resolveInitialLanguage()) }
}

export default function ResetNewPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
