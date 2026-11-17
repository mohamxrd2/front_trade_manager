// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { MediaImage } from './media-image'

// next/image simulé : on voit s'il est utilisé, et on peut le faire planter
// comme en développement quand un domaine manque dans la config chargée.
const nextImageThrowsFor = { host: '' }
vi.mock('next/image', () => ({
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => {
    if (nextImageThrowsFor.host && new URL(src).hostname === nextImageThrowsFor.host) {
      throw new Error(`Invalid src prop (${src}) on \`next/image\`, hostname "${nextImageThrowsFor.host}" is not configured`)
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img data-next-image="true" src={src} alt={alt} onError={onError} />
  },
}))

afterEach(() => {
  cleanup()
  nextImageThrowsFor.host = ''
})

const GOOGLE = 'https://lh3.googleusercontent.com/a/ACg8ocK=s96-c'

describe('MediaImage', () => {
  test('image du bucket R2 → next/image', () => {
    const { container } = render(<MediaImage src="https://pub-123.r2.dev/a/product/x.webp" alt="" fallback="AK" />)
    expect(container.querySelector('img[data-next-image]')).not.toBeNull()
  })

  test('photo Google → affichée sans planter, même si next/image la refuse', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    nextImageThrowsFor.host = 'lh3.googleusercontent.com'
    const { container } = render(<MediaImage src={GOOGLE} alt="" fallback="AK" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe(GOOGLE)
    expect(img?.hasAttribute('data-next-image')).toBe(false)
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer')
    errors.mockRestore()
  })

  test('domaine inconnu → simple <img> (chargement différé, sans next/image)', () => {
    const { container } = render(<MediaImage src="https://cdn.inconnu.example/photo.jpg" alt="Photo" fallback="AK" />)
    const img = container.querySelector('img')
    expect(img?.hasAttribute('data-next-image')).toBe(false)
    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(img?.className).toContain('object-cover')
  })

  test('image qui ne charge pas → repli (initiales)', () => {
    for (const src of ['https://cdn.inconnu.example/cassee.jpg', 'https://pub-123.r2.dev/a/product/supprimee.webp']) {
      const { container, getByText } = render(<MediaImage src={src} alt="" fallback="AK" />)
      fireEvent.error(container.querySelector('img')!)
      expect(container.querySelector('img')).toBeNull()
      expect(getByText('AK')).toBeTruthy()
      cleanup()
    }
  })

  test('pas d’image ou valeur invalide → repli', () => {
    for (const src of [null, '', 'photo.jpg', 'javascript:alert(1)']) {
      const { container, getByText } = render(<MediaImage src={src} alt="" fallback="AK" />)
      expect(container.querySelector('img')).toBeNull()
      expect(getByText('AK')).toBeTruthy()
      cleanup()
    }
  })
})
