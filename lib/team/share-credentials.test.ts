import { describe, expect, test } from 'vitest'
import { buildCredentialsMessage } from './share-credentials'

describe('buildCredentialsMessage — message WhatsApp prérempli (chantier "Équipe" §3)', () => {
  const base = {
    name: 'Koffi Yao',
    companyName: 'Awa Couture',
    loginUrl: 'https://app.waelly.com/login',
    username: 'ABC12-KOFFI',
    code: '482913',
  }

  test('français : reprend le prénom seul (tutoiement), pas le nom complet', () => {
    const message = buildCredentialsMessage({ ...base, language: 'fr' })
    expect(message).toBe(
      "Bonjour Koffi, voici tes accès à Waelly pour Awa Couture : https://app.waelly.com/login — Identifiant : ABC12-KOFFI — Code : 482913. Tu devras choisir ton propre code à la première connexion."
    )
  })

  test('anglais : même structure, texte traduit', () => {
    const message = buildCredentialsMessage({ ...base, language: 'en' })
    expect(message).toBe(
      'Hi Koffi, here is your access to Waelly for Awa Couture: https://app.waelly.com/login — Identifier: ABC12-KOFFI — Code: 482913. You\'ll need to choose your own code on first login.'
    )
  })

  test('ne garde que le premier mot du nom (prénom)', () => {
    const message = buildCredentialsMessage({ ...base, name: '  Aya Marie Koné  ', language: 'fr' })
    expect(message.startsWith('Bonjour Aya,')).toBe(true)
  })
})
