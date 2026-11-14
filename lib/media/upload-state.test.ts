import { describe, expect, test } from 'vitest'

import { ApiErrorType, type ApiError } from '@/lib/api'
import { translate } from '@/lib/i18n/translate'
import type { CompressedImage } from './compress'
import { classifyUploadError, MediaUploadError, type UploadedMedia } from './upload'
import { createUploadRunner, type UploadState } from './upload-state'

const image: CompressedImage = { blob: new Blob(['x'], { type: 'image/webp' }), width: 10, height: 10, type: 'image/webp' }
const media: UploadedMedia = { id: 'm1', url: 'https://media.example/a.webp', width: 10, height: 10, kind: 'product' }

function apiError(type: ApiErrorType, status?: number, errors?: unknown): ApiError {
  return Object.assign(new Error('x'), { type, status, errors }) as ApiError
}

describe('classifyUploadError', () => {
  test('coupure réseau ou délai dépassé → « Réessayer » proposé', () => {
    for (const type of [ApiErrorType.NETWORK, ApiErrorType.TIMEOUT]) {
      const error = classifyUploadError(apiError(type))
      expect(error.kind).toBe('network')
      expect(error.retryable).toBe(true)
    }
    expect(classifyUploadError(new TypeError('Failed to fetch')).retryable).toBe(true)
  })

  test('refus du serveur → pas de « Réessayer » (renvoyer ne changerait rien)', () => {
    expect(classifyUploadError(apiError(ApiErrorType.FORBIDDEN, 403)).kind).toBe('forbidden')
    expect(classifyUploadError(apiError(ApiErrorType.VALIDATION, 422, { file: ["Ce fichier n'est pas une image"] })).kind).toBe('invalid')
    expect(classifyUploadError(apiError(ApiErrorType.VALIDATION, 422, { file: ["L'image ne doit pas dépasser 5 Mo."] })).kind).toBe('too_large')
    expect(classifyUploadError(apiError(ApiErrorType.VALIDATION, 422, { file: ["Limite d'images atteinte"] })).kind).toBe('quota')
    expect(classifyUploadError(apiError(ApiErrorType.VALIDATION, 422)).retryable).toBe(false)
  })

  test('image trop lourde : 413 de Nginx ou 422 de Laravel, en fr comme en en → « Image trop lourde »', () => {
    // 413 renvoyé par Nginx (avec les en-têtes CORS depuis fix/cors) : axios reçoit bien la réponse.
    const nginx = classifyUploadError(apiError(ApiErrorType.UNKNOWN, 413))
    expect(nginx.kind).toBe('too_large')
    expect(nginx.retryable).toBe(false)
    expect(classifyUploadError(apiError(ApiErrorType.VALIDATION, 422, { file: ['The image must not exceed 5 MB.'] })).kind).toBe('too_large')
    expect(translate(nginx.messageKey, 'fr')).toBe('Image trop lourde (5 Mo maximum).')
    expect(translate(nginx.messageKey, 'fr')).not.toMatch(/CORS/i)
  })

  test('aucune réponse du serveur → message réseau, jamais « CORS »', () => {
    const error = classifyUploadError(apiError(ApiErrorType.TIMEOUT))
    expect(error.kind).toBe('network')
    for (const language of ['fr', 'en'] as const) expect(translate(error.messageKey, language)).not.toMatch(/CORS/i)
  })

  test('erreur serveur passagère → « Réessayer »', () => {
    expect(classifyUploadError(apiError(ApiErrorType.SERVER, 500)).retryable).toBe(true)
  })

  test('chaque erreur a son message en fr et en en', () => {
    for (const kind of ['network', 'too_large', 'invalid', 'forbidden', 'not_found', 'quota', 'server'] as const) {
      const key = new MediaUploadError(kind, false).messageKey
      for (const language of ['fr', 'en'] as const) expect(translate(key, language)).not.toBe(key)
    }
  })
})

describe('createUploadRunner', () => {
  test('progression puis image envoyée', async () => {
    const states: UploadState[] = []
    const runner = createUploadRunner(async (_img, onProgress) => {
      onProgress(40)
      onProgress(100)
      return media
    }, (s) => states.push(s))

    expect(await runner.start(image)).toEqual(media)
    expect(states.map((s) => (s.status === 'uploading' ? `uploading:${s.progress}` : s.status))).toEqual([
      'uploading:0',
      'uploading:40',
      'uploading:100',
      'done',
    ])
  })

  test('échec réseau puis « Réessayer » renvoie la même image', async () => {
    const states: UploadState[] = []
    const sent: CompressedImage[] = []
    let fail = true
    const runner = createUploadRunner(async (img) => {
      sent.push(img)
      if (fail) throw apiError(ApiErrorType.NETWORK)
      return media
    }, (s) => states.push(s))

    expect(await runner.start(image)).toBeNull()
    const failed = states.at(-1)
    expect(failed?.status).toBe('error')
    expect(failed?.status === 'error' && failed.error.retryable).toBe(true)

    fail = false
    expect(await runner.retry()).toEqual(media)
    expect(sent).toEqual([image, image])
    expect(states.at(-1)).toEqual({ status: 'done', media })
  })

  test('un envoi annulé ou remplacé ne revient pas écraser le nouvel état', async () => {
    const states: UploadState[] = []
    let resolveFirst: (m: UploadedMedia) => void = () => {}
    const runner = createUploadRunner(
      (img) => (img === image ? new Promise<UploadedMedia>((r) => (resolveFirst = r)) : Promise.resolve({ ...media, id: 'm2' })),
      (s) => states.push(s)
    )

    const first = runner.start(image)
    await runner.start({ ...image })
    resolveFirst(media)
    expect(await first).toBeNull()
    expect(states.at(-1)).toEqual({ status: 'done', media: { ...media, id: 'm2' } })
  })

  test('retry sans envoi en attente ne fait rien', async () => {
    const runner = createUploadRunner(async () => media, () => {})
    expect(await runner.retry()).toBeNull()
  })
})
