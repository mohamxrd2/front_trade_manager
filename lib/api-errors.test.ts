import { describe, expect, test } from 'vitest'

import { translate } from '@/lib/i18n/translate'
import {
  API_ERROR_MESSAGE_KEYS,
  ApiErrorType,
  classifyFailure,
  newRequestId,
  shortRequestId,
  shouldAutoRetry,
  type FailureInfo,
} from './api-errors'

const base: FailureInfo = { hasResponse: false, timedOut: false, online: true, isDev: false }

describe('classifyFailure — le bon message selon l’erreur', () => {
  test('hors ligne → « Pas de connexion internet », quoi qu’il arrive', () => {
    expect(classifyFailure({ ...base, online: false })).toBe(ApiErrorType.NETWORK)
    expect(classifyFailure({ ...base, online: false, timedOut: true })).toBe(ApiErrorType.NETWORK)
  })

  test('délai dépassé → serveur lent', () => {
    expect(classifyFailure({ ...base, timedOut: true })).toBe(ApiErrorType.TIMEOUT)
  })

  test('aucune réponse en production → serveur lent, JAMAIS « Erreur CORS »', () => {
    expect(classifyFailure(base)).toBe(ApiErrorType.TIMEOUT)
  })

  test('aucune réponse en développement → message technique CORS', () => {
    expect(classifyFailure({ ...base, isDev: true })).toBe(ApiErrorType.CORS)
  })

  test('vraie réponse 5xx → problème du service', () => {
    for (const status of [500, 502, 503, 504]) {
      expect(classifyFailure({ ...base, hasResponse: true, status })).toBe(ApiErrorType.SERVER)
    }
  })

  test('autres statuts', () => {
    expect(classifyFailure({ ...base, hasResponse: true, status: 401 })).toBe(ApiErrorType.UNAUTHORIZED)
    expect(classifyFailure({ ...base, hasResponse: true, status: 419 })).toBe(ApiErrorType.CSRF)
    expect(classifyFailure({ ...base, hasResponse: true, status: 422 })).toBe(ApiErrorType.VALIDATION)
    expect(classifyFailure({ ...base, hasResponse: true, status: 429 })).toBe(ApiErrorType.UNKNOWN)
  })

  test('chaque type a son message en fr et en en', () => {
    for (const language of ['fr', 'en'] as const) {
      for (const key of Object.values(API_ERROR_MESSAGE_KEYS)) {
        const text = translate(key, language, { origin: 'https://waelly.com' })
        expect(text, key).not.toBe(key)
        expect(text).not.toContain('{{')
      }
    }
    expect(translate(API_ERROR_MESSAGE_KEYS[ApiErrorType.TIMEOUT], 'fr')).toBe('Le serveur met du temps à répondre. Réessayez dans un instant.')
    expect(translate(API_ERROR_MESSAGE_KEYS[ApiErrorType.NETWORK], 'fr')).toContain('Pas de connexion internet')
    expect(translate(API_ERROR_MESSAGE_KEYS[ApiErrorType.SERVER], 'fr')).toContain('Réessayez dans quelques minutes')
    expect(translate(API_ERROR_MESSAGE_KEYS[ApiErrorType.CORS], 'en', { origin: 'https://www.waelly.com' })).toContain('https://www.waelly.com')
  })
})

describe('shouldAutoRetry — un seul nouvel essai, seulement quand c’est sans danger', () => {
  const timeout = { type: ApiErrorType.TIMEOUT, retryCount: 0 }

  test('GET sans réponse ou indisponible (502/503/504) → un nouvel essai', () => {
    expect(shouldAutoRetry({ ...timeout, method: 'get' })).toBe(true)
    for (const status of [502, 503, 504]) {
      expect(shouldAutoRetry({ method: 'GET', type: ApiErrorType.SERVER, status, retryCount: 0 })).toBe(true)
    }
  })

  test('jamais deux fois', () => {
    expect(shouldAutoRetry({ ...timeout, method: 'GET', retryCount: 1 })).toBe(false)
  })

  test('jamais pour une écriture (une vente rejouée serait créée deux fois)', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(shouldAutoRetry({ ...timeout, method })).toBe(false)
    }
  })

  test('la connexion, elle, peut être rejouée une fois', () => {
    expect(shouldAutoRetry({ ...timeout, method: 'POST', skipRetry: true, retryOnceWhenUnavailable: true })).toBe(true)
    expect(shouldAutoRetry({ ...timeout, method: 'POST', skipRetry: true, retryOnceWhenUnavailable: true, retryCount: 1 })).toBe(false)
  })

  test('jamais hors ligne, ni sur un refus, ni sur une erreur 500 « réelle »', () => {
    expect(shouldAutoRetry({ method: 'GET', type: ApiErrorType.NETWORK, retryCount: 0 })).toBe(false)
    expect(shouldAutoRetry({ method: 'GET', type: ApiErrorType.UNKNOWN, status: 429, retryCount: 0 })).toBe(false)
    expect(shouldAutoRetry({ method: 'GET', type: ApiErrorType.SERVER, status: 500, retryCount: 0 })).toBe(false)
    expect(shouldAutoRetry({ method: 'POST', type: ApiErrorType.UNKNOWN, status: 429, retryCount: 0, retryOnceWhenUnavailable: true })).toBe(false)
  })

  test('un GET qui a demandé à ne jamais être rejoué ne l’est pas', () => {
    expect(shouldAutoRetry({ ...timeout, method: 'GET', skipRetry: true })).toBe(false)
  })
})

describe('identifiant de requête', () => {
  test('unique, et accepté par le serveur ([A-Za-z0-9-]{8,64})', () => {
    const a = newRequestId()
    expect(a).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(a).not.toBe(newRequestId())
  })

  test('forme courte affichée, retrouvable dans les logs', () => {
    expect(shortRequestId('w-3f2a9c1e-77aa-4b1c-9d2e-0123456789ab')).toBe('3f2a9c1e')
    expect(shortRequestId('d65680a5efdd63b0a462ab3dcbce6524')).toBe('d65680a5')
    expect(shortRequestId(undefined)).toBeNull()
  })
})
