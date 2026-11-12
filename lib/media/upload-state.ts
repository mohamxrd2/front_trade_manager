import type { CompressedImage } from './compress'
import { classifyUploadError, type MediaUploadError, type UploadedMedia } from './upload'

/**
 * États de l'envoi d'une image, sans React (testable) : ImageUploader
 * s'abonne et affiche la barre de progression, l'erreur et « Réessayer ».
 * Le fichier compressé est gardé : « Réessayer » le renvoie tel quel.
 */
export type UploadState =
  | { status: 'idle' }
  | { status: 'compressing' }
  | { status: 'uploading'; progress: number }
  | { status: 'error'; error: MediaUploadError }
  | { status: 'done'; media: UploadedMedia }

export type Sender = (image: CompressedImage, onProgress: (percent: number) => void) => Promise<UploadedMedia>

export function createUploadRunner(send: Sender, onState: (state: UploadState) => void) {
  let pending: CompressedImage | null = null
  let run = 0

  const start = async (image: CompressedImage): Promise<UploadedMedia | null> => {
    pending = image
    const id = ++run
    onState({ status: 'uploading', progress: 0 })
    try {
      const media = await send(image, (progress) => {
        if (id === run) onState({ status: 'uploading', progress })
      })
      if (id !== run) return null
      pending = null
      onState({ status: 'done', media })
      return media
    } catch (error) {
      if (id === run) onState({ status: 'error', error: classifyUploadError(error) })
      return null
    }
  }

  return {
    start,
    /** Renvoie la dernière image après un échec. */
    retry: () => (pending ? start(pending) : Promise.resolve(null)),
    /** Abandonne l'envoi en cours (un résultat tardif est ignoré). */
    cancel: () => {
      run++
      pending = null
      onState({ status: 'idle' })
    },
  }
}
