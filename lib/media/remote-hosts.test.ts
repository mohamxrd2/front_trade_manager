import { describe, expect, test } from 'vitest'

import { displayableImage, imageRenderer, isOptimizable, mediaRemotePatterns } from './remote-hosts'

const patterns = mediaRemotePatterns({ NEXT_PUBLIC_MEDIA_URL: 'https://media.waelly.com', NEXT_PUBLIC_API_URL: 'https://api.waelly.com' })

describe('images optimisées par next/image', () => {
  test('bucket R2 (r2.dev ou domaine personnalisé), avatars Google, logos de l’API', () => {
    expect(isOptimizable('https://pub-123.r2.dev/a/product/x.webp', patterns)).toBe(true)
    expect(isOptimizable('https://media.waelly.com/a/logo/x.webp', patterns)).toBe(true)
    expect(isOptimizable('https://lh3.googleusercontent.com/a/abc', patterns)).toBe(true)
    expect(isOptimizable('https://api.waelly.com/storage/company-logos/x.png', patterns)).toBe(true)
  })

  test('toutes les photos de profil Google (lh3, lh4…)', () => {
    expect(isOptimizable('https://lh4.googleusercontent.com/a/abc', patterns)).toBe(true)
    expect(isOptimizable('https://googleusercontent.com.evil.example/a', patterns)).toBe(false)
  })

  test('choix du rendu : next/image pour un domaine déclaré ou un chemin du site, <img> sinon', () => {
    expect(imageRenderer('https://pub-123.r2.dev/a/x.webp', patterns)).toEqual({ kind: 'next', url: 'https://pub-123.r2.dev/a/x.webp' })
    expect(imageRenderer('/images/logo.png', patterns)).toEqual({ kind: 'next', url: '/images/logo.png' })
    expect(imageRenderer('https://cdn.inconnu.example/x.jpg', patterns)).toEqual({ kind: 'img', url: 'https://cdn.inconnu.example/x.jpg' })
    expect(imageRenderer('http://localhost:8000/storage/media/x.webp', patterns).kind).toBe('img')
    expect(imageRenderer('//cdn.example/x.jpg', patterns).kind).toBe('none')
    expect(imageRenderer('', patterns).kind).toBe('none')
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
