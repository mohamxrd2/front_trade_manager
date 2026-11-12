import api, { isApiError, ApiErrorType, type NoRetryRequestConfig } from '@/lib/api'
import type { MediaKind } from './compress'

/** Image renvoyée par POST /api/media. */
export interface UploadedMedia {
  id: string
  url: string
  width: number
  height: number
  kind: MediaKind
}

export type UploadErrorKind = 'network' | 'too_large' | 'invalid' | 'forbidden' | 'not_found' | 'quota' | 'server'

/** Erreur d'envoi, avec la clé de traduction et si « Réessayer » a un sens. */
export class MediaUploadError extends Error {
  constructor(
    public readonly kind: UploadErrorKind,
    public readonly retryable: boolean
  ) {
    super(kind)
  }

  get messageKey(): string {
    return `media.errors.${this.kind}`
  }
}

/** Erreur réseau ou serveur → MediaUploadError (jamais le texte brut du backend). */
export function classifyUploadError(error: unknown): MediaUploadError {
  if (error instanceof MediaUploadError) return error
  if (!isApiError(error)) return new MediaUploadError('network', true)
  if (error.type === ApiErrorType.NETWORK || error.type === ApiErrorType.TIMEOUT) return new MediaUploadError('network', true)

  switch (error.status) {
    case 413:
      return new MediaUploadError('too_large', false)
    case 403:
      return new MediaUploadError('forbidden', false)
    case 404:
      return new MediaUploadError('not_found', false)
    case 422: {
      const errors = error.errors as { file?: string[] } | undefined
      const text = errors?.file?.join(' ') ?? ''
      if (/limite|limit/i.test(text)) return new MediaUploadError('quota', false)
      if (/Mo|MB/.test(text)) return new MediaUploadError('too_large', false)
      return new MediaUploadError('invalid', false)
    }
    case 429:
      return new MediaUploadError('server', true)
    default:
      return new MediaUploadError('server', true)
  }
}

export interface UploadMediaParams {
  blob: Blob
  kind: MediaKind
  /** Élément à qui rattacher l'image ; absent pour la photo d'un article pas encore créé. */
  ownerId?: string | null
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

export async function uploadMedia({ blob, kind, ownerId, onProgress, signal }: UploadMediaParams): Promise<UploadedMedia> {
  const form = new FormData()
  form.append('file', blob, blob.type === 'image/jpeg' ? 'image.jpg' : 'image.webp')
  form.append('kind', kind)
  if (ownerId) form.append('owner_id', ownerId)

  try {
    // Pas de retry automatique : « Réessayer » est proposé à l'utilisateur.
    const config: NoRetryRequestConfig = {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
      skipRetry: true,
      onUploadProgress: onProgress
        ? (event) => {
            if (event.total) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
          }
        : undefined,
    }
    const response = await api.post<{ data: UploadedMedia }>('/api/media', form, config)
    return response.data.data
  } catch (error) {
    throw classifyUploadError(error)
  }
}

/** Retire l'image d'un élément ("me" : sa propre photo de profil). */
export async function removeMedia(kind: MediaKind, ownerId: string): Promise<void> {
  try {
    await api.delete(`/api/media/${kind}/${encodeURIComponent(ownerId)}`)
  } catch (error) {
    throw classifyUploadError(error)
  }
}
