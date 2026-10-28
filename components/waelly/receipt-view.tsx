import * as React from 'react'

import type { ReceiptModel } from '@/lib/receipt/build-receipt'

export interface ReceiptViewProps {
  model: ReceiptModel
  /** Image du QR code déjà générée (data URL) — calculée par l'appelant (voir lib/receipt/qr.ts), ReceiptView reste un composant pur sans effet, utilisable aussi côté rendu statique (impression). */
  qrDataUrl?: string | null
  className?: string
}

/**
 * UN SEUL composant pour l'aperçu, l'impression (rendu statique dans un
 * iframe dédié, voir lib/receipt/print-receipt.ts) et l'export image/PDF
 * (capturé via html-to-image sur ce même DOM) — jamais trois rendus
 * différents à maintenir. Police monospace sur toute la largeur : les
 * lignes "colonnes" de buildReceipt() sont déjà paddées en espaces pour
 * s'aligner pixel-perfect sur `model.charsPerLine`.
 */
function ReceiptView({ model, qrDataUrl, className }: ReceiptViewProps) {
  return (
    <div
      data-slot="receipt-view"
      className={className}
      style={{
        width: `${model.charsPerLine}ch`,
        maxWidth: '100%',
        margin: '0 auto',
        fontFamily:
          'ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.5,
        color: '#000',
        background: '#fff',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {model.rows.map((row, i) => {
        const key = `${row.kind}-${i}`
        if (row.kind === 'logo') {
          return (
            // eslint-disable-next-line @next/next/no-img-element -- rendu aussi dans un iframe d'impression hors du pipeline next/image.
            <img
              key={key}
              data-receipt-logo="true"
              src={row.url}
              alt=""
              style={{
                display: 'block',
                margin: '0 auto 6px',
                maxWidth: '40%',
                filter: 'grayscale(1) contrast(1.1)',
              }}
            />
          )
        }
        if (row.kind === 'separator') {
          return (
            <div key={key} style={{ textAlign: 'center' }}>
              {row.text}
            </div>
          )
        }
        if (row.kind === 'spacer') {
          return <div key={key} style={{ height: 8 }} />
        }
        if (row.kind === 'qr') {
          if (!qrDataUrl) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element -- idem (iframe d'impression).
            <img key={key} src={qrDataUrl} alt={row.payload} style={{ display: 'block', margin: '8px auto', width: 96, height: 96 }} />
          )
        }
        if (row.kind === 'columns') {
          return (
            <div key={key} style={{ textAlign: 'left' }}>
              {row.text}
            </div>
          )
        }
        return (
          <div
            key={key}
            style={{
              textAlign: row.align,
              fontWeight: row.bold ? 700 : 400,
              fontSize: row.size === 'large' ? 16 : 13,
            }}
          >
            {row.text}
          </div>
        )
      })}
    </div>
  )
}

export { ReceiptView }
