import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ReceiptView } from '@/components/waelly/receipt-view'
import type { ReceiptModel, ReceiptWidth } from './build-receipt'

/**
 * Impression classique (window.print(), tous appareils) — DANS UN IFRAME
 * DÉDIÉ plutôt que via la feuille @media print globale de l'app : le reste
 * de l'interface (boutons, barres fixes, cartes…) a déjà ses propres règles
 * d'impression pour d'autres écrans (factures…), qui ne conviennent pas à
 * un ticket 58/80mm (taille de police, @page, marges). L'iframe isole
 * complètement le document imprimé — aucun risque d'interférence, aucune
 * règle globale à contourner.
 *
 * Réutilise ReceiptView tel quel (rendu statique) — "un seul composant
 * pour l'aperçu, l'impression et l'export" (voir ce composant).
 */
/** `false` si l'impression n'a pas pu démarrer (iframe/fenêtre indisponible) — l'appelant doit alors prévenir l'utilisateur plutôt que de laisser le bouton "Imprimer" ne rien faire en silence. */
export function printReceiptModel(model: ReceiptModel, qrDataUrl?: string | null): boolean {
  const markup = renderToStaticMarkup(React.createElement(ReceiptView, { model, qrDataUrl }))
  const pageSize: ReceiptWidth = model.width

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  // Hors écran mais avec une VRAIE taille (jamais 0×0) : certains navigateurs
  // mobiles refusent silencieusement d'imprimer un iframe sans dimensions —
  // aucune boîte de dialogue ne s'ouvre, rien ne se passe, "le bouton ne
  // fonctionne pas". Décalé hors de l'écran plutôt que réduit à rien.
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '380px'
  iframe.style.height = '600px'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  document.body.appendChild(iframe)

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500)
  }

  const doc = iframe.contentWindow?.document
  if (!doc) {
    cleanup()
    return false
  }

  doc.open()
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { size: ${pageSize} auto; margin: 0; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { padding: 8px 4px; }
    </style>
  </head>
  <body>${markup}</body>
</html>`)
  doc.close()

  const win = iframe.contentWindow
  if (!win) {
    cleanup()
    return false
  }

  win.onafterprint = cleanup
  // Repli si l'évènement afterprint n'est pas déclenché (certains navigateurs
  // mobiles, impression annulée) — ne laisse jamais l'iframe en mémoire.
  window.setTimeout(cleanup, 60_000)

  // Attend le logo/QR (sinon risque d'impression avant leur décodage — pas
  // de garantie que l'évènement "load" de l'iframe suive un document.write()
  // dans tous les navigateurs, donc on attend les images nous-mêmes).
  const images = Array.from(doc.images)
  const waitForImages = Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
    )
  )
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 2000))

  Promise.race([waitForImages, timeout]).then(() => {
    try {
      win.focus()
      win.print()
    } catch {
      // Best-effort — certains navigateurs mobiles refusent print() dans de rares cas ; l'iframe est nettoyée quoi qu'il arrive (timeout ci-dessus).
    }
  })

  return true
}
