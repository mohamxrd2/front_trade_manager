import { translate } from '@/lib/i18n/translate'
import type { AppLanguage } from '@/lib/i18n/current-language'

export interface CredentialsMessageInput {
  name: string
  companyName: string
  loginUrl: string
  username: string
  code: string
  language: AppLanguage
}

/** Premier prénom du nom complet — le message WhatsApp est au tutoiement direct (section 3 du chantier "Équipe"). */
function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName
}

export function buildCredentialsMessage({ name, companyName, loginUrl, username, code, language }: CredentialsMessageInput): string {
  return translate('team.whatsappMessage', language, {
    firstName: firstName(name),
    companyName,
    link: loginUrl,
    username,
    code,
  })
}

/** Ouvre WhatsApp avec le message prérempli ; si la fenêtre est bloquée (popup blocker), repli sur le partage natif quand disponible. */
export function sendCredentialsViaWhatsApp(message: string): void {
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
  const win = typeof window !== 'undefined' ? window.open(waUrl, '_blank', 'noopener,noreferrer') : null

  if (!win && typeof navigator !== 'undefined' && navigator.share) {
    void navigator.share({ text: message }).catch(() => {})
  }
}
