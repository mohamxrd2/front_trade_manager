// @vitest-environment jsdom
import * as React from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { translate } from '@/lib/i18n/translate'
import { ProductPhoto } from './product-photo'

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => <img src={src} alt={alt} className={className} />,
}))

vi.mock('@/lib/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, string | number>) => translate(key, 'fr', params), language: 'fr' }),
}))

afterEach(cleanup)

const PHOTO = 'https://pub-123.r2.dev/a/product/x.webp'

describe('ProductPhoto (fiche article)', () => {
  test('image entière (object-contain), jamais recadrée', () => {
    const { container } = render(<ProductPhoto src={PHOTO} alt="Sac" className="aspect-[4/3] w-full" />)
    const img = container.querySelector('img')!
    expect(img.className).toContain('object-contain')
    expect(img.className).not.toContain('object-cover')
  })

  test('clic → plein écran ; Échap ferme', () => {
    render(<ProductPhoto src={PHOTO} alt="Sac" />)
    fireEvent.click(screen.getByRole('button', { name: 'Voir la photo en grand : Sac' }))
    const dialog = screen.getByRole('dialog', { name: 'Photo : Sac' })
    expect(dialog.querySelector('img')?.className).toContain('object-contain')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('la croix et un tap en dehors de la photo ferment ; un tap sur la photo, non', () => {
    render(<ProductPhoto src={PHOTO} alt="Sac" />)
    const open = screen.getByRole('button', { name: 'Voir la photo en grand : Sac' })

    fireEvent.click(open)
    fireEvent.click(screen.getByRole('dialog').querySelector('[data-viewer-photo] img')!)
    expect(screen.queryByRole('dialog')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la photo' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(open)
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('pas de photo → repli, rien à ouvrir', () => {
    render(<ProductPhoto src={null} alt="Sac" fallback={<span>Aucune photo</span>} />)
    expect(screen.getByText('Aucune photo')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
