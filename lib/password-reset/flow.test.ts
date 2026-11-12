import { describe, expect, test } from 'vitest'

import { translate } from '@/lib/i18n/translate'
import { missingPasswordRequirements, passwordScore } from '@/lib/password-rules'
import {
  FORGOT_PATH,
  NEW_PASSWORD_PATH,
  RESET_STORAGE_KEY,
  VERIFY_PATH,
  clearResetTicket,
  forgotLinkTarget,
  formatCountdown,
  initialEmail,
  isEmail,
  loadResetTicket,
  resetErrorMessage,
  saveResetTicket,
  withEmail,
} from './flow'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  }
}

describe('parcours des 3 écrans', () => {
  test('chaque écran passe l’e-mail au suivant dans l’URL', () => {
    expect(withEmail(VERIFY_PATH, ' awa@example.com ')).toBe('/reset-password/verify?email=awa%40example.com')
    expect(withEmail(NEW_PASSWORD_PATH, 'a+b@x.ci')).toBe('/reset-password/new?email=a%2Bb%40x.ci')
    expect(withEmail(FORGOT_PATH, '')).toBe('/forgot-password')
  })

  test('le jeton passe de l’écran 2 à l’écran 3 par sessionStorage, puis disparaît', () => {
    const storage = memoryStorage()
    saveResetTicket({ email: 'awa@example.com', token: 'jeton', expiresAt: 2_000 }, storage)

    expect(loadResetTicket(storage, 1_000)).toEqual({ email: 'awa@example.com', token: 'jeton', expiresAt: 2_000 })
    clearResetTicket(storage)
    expect(loadResetTicket(storage, 1_000)).toBeNull()
  })

  test('un jeton expiré ou illisible renvoie à l’écran 1 (null) et est effacé', () => {
    const storage = memoryStorage()
    saveResetTicket({ email: 'awa@example.com', token: 'jeton', expiresAt: 1_000 }, storage)
    expect(loadResetTicket(storage, 1_000)).toBeNull()
    expect(storage.data.has(RESET_STORAGE_KEY)).toBe(false)

    storage.setItem(RESET_STORAGE_KEY, '{pas du json')
    expect(loadResetTicket(storage)).toBeNull()
    expect(loadResetTicket(null)).toBeNull()
  })
})

describe('pré-remplissage de l’e-mail', () => {
  test('repris de ?email= seulement s’il ressemble à un e-mail', () => {
    expect(initialEmail('awa@example.com')).toBe('awa@example.com')
    expect(initialEmail(' awa@example.com ')).toBe('awa@example.com')
    expect(initialEmail('ABJ-AWA')).toBe('')
    expect(initialEmail(null)).toBe('')
  })

  test('isEmail', () => {
    expect(isEmail('a@b.ci')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
    expect(isEmail('')).toBe(false)
  })
})

describe('lien « Mot de passe oublié ? » de la connexion', () => {
  test('un e-mail saisi est repris sur l’écran 1', () => {
    expect(forgotLinkTarget('awa@example.com')).toEqual({ kind: 'link', href: '/forgot-password?email=awa%40example.com' })
  })

  test('champ vide : parcours normal', () => {
    expect(forgotLinkTarget('  ')).toEqual({ kind: 'link', href: '/forgot-password' })
  })

  test('identifiant de membre (sans @) : message « Demandez à votre responsable »', () => {
    expect(forgotLinkTarget('ABJ12-KOFFI')).toEqual({ kind: 'member' })
    for (const language of ['fr', 'en'] as const) {
      expect(translate('auth.forgot.memberHintShort', language)).not.toBe('auth.forgot.memberHintShort')
    }
  })
})

describe('compte à rebours du renvoi', () => {
  test('format m:ss', () => {
    expect(formatCountdown(60)).toBe('1:00')
    expect(formatCountdown(9)).toBe('0:09')
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-3)).toBe('0:00')
  })
})

describe('validation du mot de passe (mêmes règles que le backend)', () => {
  test('liste ce qui manque', () => {
    expect(missingPasswordRequirements('abc')).toEqual(['length', 'upper', 'digit', 'special'])
    expect(missingPasswordRequirements('abcdefgh1!')).toEqual(['upper'])
    expect(missingPasswordRequirements('Nouveau#Pass9')).toEqual([])
  })

  test('jauge de 0 à 4', () => {
    expect(passwordScore('')).toBe(0)
    expect(passwordScore('abcdefgh')).toBe(1)
    expect(passwordScore('Nouveau#Pass9')).toBe(4)
  })
})

describe('messages d’erreur', () => {
  test('chaque code du backend a son message, en fr et en en', () => {
    const cases = [
      { code: 'TOO_MANY_REQUESTS' },
      { code: 'CODE_EXPIRED' },
      { code: 'TOO_MANY_ATTEMPTS' },
      { code: 'TOKEN_INVALID' },
      { code: 'INVALID_CODE' },
      { code: 'INVALID_CODE', remaining: 0 },
      { code: 'INVALID_CODE', remaining: 1 },
      { code: 'INVALID_CODE', remaining: 3 },
      { network: true },
      { status: 500 },
    ]
    for (const language of ['fr', 'en'] as const) {
      for (const failure of cases) {
        const { key, params } = resetErrorMessage(failure)
        const text = translate(key, language, params)
        expect(text, key).not.toBe(key)
        expect(text).not.toContain('{')
      }
    }
  })

  test('nombre d’essais restants', () => {
    const { key, params } = resetErrorMessage({ code: 'INVALID_CODE', remaining: 1 })
    expect(translate(key, 'fr', params)).toBe('Code incorrect. Il vous reste 1 essai.')
    expect(translate(key, 'en', resetErrorMessage({ code: 'INVALID_CODE', remaining: 3 }).params)).toBe('Incorrect code. 3 attempts left.')
  })

  test('un 429 sans code reste le message générique de limite', () => {
    expect(resetErrorMessage({ status: 429 }).key).toBe('auth.forgot.tooManyRequests')
  })
})
