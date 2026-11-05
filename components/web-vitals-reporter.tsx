'use client'

import { useReportWebVitals } from 'next/web-vitals'

const ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/web-vitals`
const TRACKED = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])

/**
 * Core Web Vitals des vrais utilisateurs → backend (table web_vitals, lue
 * par `php artisan web-vitals:report`). En production seulement.
 * sendBeacon : envoi non bloquant, qui survit à la fermeture de l'onglet ;
 * corps en text/plain pour éviter un preflight CORS.
 */
function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== 'production' || !TRACKED.has(metric.name)) return
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return

    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      page: window.location.pathname.slice(0, 191),
      device: window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop',
    })
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))
  })

  return null
}

export { WebVitalsReporter }
