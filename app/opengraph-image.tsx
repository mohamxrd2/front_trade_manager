import { ImageResponse } from 'next/og'

import type { AppLanguage } from '@/lib/i18n/current-language'
import { resolveInitialLanguage } from '@/lib/i18n/resolve-initial-language'

export const runtime = 'edge'
export const alt = 'Waelly — Gérez stock, ventes et factures de votre commerce' // i18n:allow — export statique évalué au chargement du module (pas de requête disponible), le rendu réel plus bas est bien bilingue
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const TAGLINE: Record<AppLanguage, string> = {
  fr: 'Gérez stock, ventes et factures de votre commerce',
  en: 'Manage your inventory, sales and invoices',
}

export default async function OpengraphImage() {
  const language = await resolveInitialLanguage()
  const tagline = TAGLINE[language]
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          background:
            'radial-gradient(70% 120% at 50% 0%, #7A5CF5 0%, #4B2FD6 45%, #2A1A9E 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: 48,
              background: 'radial-gradient(100% 100% at 30% 20%, #8C74FF, #3420B8)',
            }}
          >
            W
          </div>
          <div style={{ display: 'flex', color: '#FFFFFF', fontWeight: 800, fontSize: 64, letterSpacing: '-0.02em' }}>
            Waelly
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            maxWidth: 820,
            textAlign: 'center',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 36,
            lineHeight: 1.3,
          }}
        >
          {tagline}
        </div>
      </div>
    ),
    { ...size }
  )
}
