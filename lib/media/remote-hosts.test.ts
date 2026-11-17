import { describe, expect, test } from 'vitest'

import { displayableImage, isOptimizable, mediaRemotePatterns } from './remote-hosts'

const patterns = mediaRemotePatterns({ NEXT_PUBLIC_MEDIA_URL: 'https://media.waelly.com', NEXT_PUBLIC_API_URL: 'https://api.waelly.com' })

describe('images optimisées par next/image', () => {
  test('bucket R2 (r2.dev ou domaine personnalisé), avatars Google, logos de l’API', () => {
    expect(isOptimizable('https://pub-123.r2.dev/a/product/x.webp', patterns)).toBe(true)
    expect(isOptimizable('https://media.waelly.com/a/logo/x.webp', patterns)).toBe(true)
    expect(isOptimizable('https://lh3.googleusercontent.com/a/abc', patterns)).toBe(true)
    expect(isOptimizable('https://api.waelly.com/storage/company-logos/x.png', patterns)).toBe(true)
  })

  test('autre hôte, adresse locale ou aperçu : affichés tels quels', () => {
    expect(isOptimizable('https://example.com/photo.jpg', patterns)).toBe(false)
    expect(isOptimizable('https://api.waelly.com/autre/x.png', patterns)).toBe(false)
    expect(isOptimizable('http://localhost:8000/storage/media/x.webp')).toBe(false)
    expect(isOptimizable('blob:http://localhost:3000/abc', patterns)).toBe(false)
  })
})

describe('anciennes valeurs de articles.image', () => {
  test('URL externe gardée, valeur vide ou invalide ignorée', () => {
    expect(displayableImage('https://ik.imagekit.io/x.jpg')).toBe('https://ik.imagekit.io/x.jpg')
    expect(displayableImage('')).toBeNull()
    expect(displayableImage('   ')).toBeNull()
    expect(displayableImage('photo.jpg')).toBeNull()
    expect(displayableImage('javascript:alert(1)')).toBeNull()
    expect(displayableImage(null)).toBeNull()
  })
})
