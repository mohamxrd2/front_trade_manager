import { describe, expect, test, vi } from 'vitest'

import { receiptFallbackFor, shareFileNow } from './ios-share'

const file = new File(['x'], 'ticket-V-1.png', { type: 'image/png' })
const err = (name: string) => Object.assign(new Error(name), { name })

describe('shareFileNow — partage du ticket préparé à l’avance', () => {
  test('navigator.share est appelé immédiatement, de façon synchrone (aucune attente avant)', () => {
    const share = vi.fn().mockResolvedValue(undefined)
    void shareFileNow(file, 'Ticket', { canShare: () => true, share })
    // Pas de await : l'appel doit déjà avoir eu lieu, dans le geste de l'utilisateur.
    expect(share).toHaveBeenCalledTimes(1)
    expect(share.mock.calls[0][0].files[0]).toBe(file)
  })

  test('partage réussi', async () => {
    await expect(shareFileNow(file, 'Ticket', { canShare: () => true, share: vi.fn().mockResolvedValue(undefined) })).resolves.toBe('shared')
  })

  test('AbortError (annulé par l’utilisateur) → rien à afficher', async () => {
    await expect(shareFileNow(file, 'T', { canShare: () => true, share: vi.fn().mockRejectedValue(err('AbortError')) })).resolves.toBe('cancelled')
  })

  test('NotAllowedError (geste perdu) → « Touchez à nouveau »', async () => {
    await expect(shareFileNow(file, 'T', { canShare: () => true, share: vi.fn().mockRejectedValue(err('NotAllowedError')) })).resolves.toBe('retry')
  })

  test('autre erreur, ou partage de fichier indisponible → image en plein écran', async () => {
    await expect(shareFileNow(file, 'T', { canShare: () => true, share: vi.fn().mockRejectedValue(err('TypeError')) })).resolves.toBe('fallback')
    await expect(shareFileNow(file, 'T', { canShare: () => false, share: vi.fn() })).resolves.toBe('fallback')
    await expect(shareFileNow(file, 'T', {})).resolves.toBe('fallback')
  })
})

describe('receiptFallbackFor', () => {
  test('iOS : image en plein écran, jamais un téléchargement <a download>', () => {
    expect(receiptFallbackFor({ ios: true })).toBe('image-modal')
    expect(receiptFallbackFor({ ios: false })).toBe('download')
  })
})
