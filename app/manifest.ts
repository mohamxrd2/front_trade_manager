import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Waelly',
    short_name: 'Waelly',
    description: 'Gérez stock, ventes et factures de votre commerce.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F3F3F7',
    theme_color: '#5B3FE6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
