import { cookies, headers } from 'next/headers'

import { LANGUAGE_COOKIE_NAME, type AppLanguage } from './current-language'

/** Server-only : cookie `app-language`, puis Accept-Language — même résolution partout (RootLayout, generateMetadata de chaque route). */
export async function resolveInitialLanguage(): Promise<AppLanguage> {
  const cookieStore = await cookies()
  const cookieLanguage = cookieStore.get(LANGUAGE_COOKIE_NAME)?.value
  if (cookieLanguage === 'en' || cookieLanguage === 'fr') return cookieLanguage

  const acceptLanguage = (await headers()).get('accept-language') ?? ''
  return acceptLanguage.toLowerCase().startsWith('en') ? 'en' : 'fr'
}
