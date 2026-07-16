import { IconBrandFacebookFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { SOCIAL_AUTH_URLS } from '@/lib/services/social-auth'
import { GoogleIcon } from './google-icon'

/**
 * Boutons de connexion sociale aux couleurs officielles de chaque marque :
 * Google (fond blanc, bordure grise, logo multicolore) et Facebook (fond
 * bleu #1877F2, icône/texte blancs). Navigation plein écran via <a href>
 * (pas de fetch/axios) — voir lib/services/social-auth.ts.
 */

export function GoogleAuthButton() {
  return (
    <Button
      variant="outline"
      type="button"
      asChild
      className="border-[#dadce0] bg-white text-[#3c4043] shadow-sm hover:bg-[#f8f9fa] hover:text-[#3c4043] dark:border-[#dadce0] dark:bg-white dark:text-[#3c4043] dark:hover:bg-[#f8f9fa]"
    >
      <a href={SOCIAL_AUTH_URLS.google}>
        <GoogleIcon className="h-4 w-4" />
        Google
      </a>
    </Button>
  )
}

export function FacebookAuthButton() {
  return (
    <Button
      variant="outline"
      type="button"
      asChild
      className="border-transparent bg-[#1877F2] text-white shadow-sm hover:bg-[#166FE5] hover:text-white dark:border-transparent dark:bg-[#1877F2] dark:text-white dark:hover:bg-[#166FE5]"
    >
      <a href={SOCIAL_AUTH_URLS.facebook}>
        <IconBrandFacebookFilled className="h-4 w-4" />
        Facebook
      </a>
    </Button>
  )
}
