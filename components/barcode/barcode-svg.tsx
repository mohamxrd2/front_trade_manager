'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { encodeBarcode } from '@/lib/barcode/symbology'

interface BarcodeSvgProps {
  value: string
  /** Hauteur des barres en unités de module (la largeur s'adapte au conteneur). */
  barHeight?: number
  showText?: boolean
  className?: string
  /** Libellé pour les lecteurs d'écran ; absent : décoratif (le numéro est lu à côté). */
  label?: string
  style?: React.CSSProperties
}

/**
 * Dessin vectoriel d'un code-barre (EAN-13, EAN-8, Code 128), le même que
 * l'étiquette imprimée en image : net à toutes les tailles, noir sur blanc.
 */
export function BarcodeSvg({ value, barHeight = 40, showText = true, className, label, style }: BarcodeSvgProps) {
  const encoded = React.useMemo(() => {
    try {
      return encodeBarcode(value)
    } catch {
      return null
    }
  }, [value])
  if (!encoded) return null

  const width = encoded.quietLeft + encoded.modules.length + encoded.quietRight
  const height = barHeight + (showText ? 11 : 0)

  // Barres consécutives fusionnées en un seul rectangle.
  const bars: Array<{ x: number; w: number }> = []
  encoded.modules.forEach((black, i) => {
    if (!black) return
    const last = bars[bars.length - 1]
    if (last && last.x + last.w === encoded.quietLeft + i) last.w += 1
    else bars.push({ x: encoded.quietLeft + i, w: 1 })
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block bg-white', className)}
      style={style}
      shapeRendering="crispEdges"
    >
      <rect width={width} height={height} fill="#fff" />
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={barHeight} fill="#000" />
      ))}
      {showText ? (
        // Un chiffre au centre de chaque case, cases égales d'un bord à l'autre des barres : jamais décalé ni plus large que le code.
        <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize={Math.min(8, (encoded.modules.length / encoded.text.length) * 1.5)} textAnchor="middle" fill="#000">
          {[...encoded.text].map((char, i) => {
            const cell = encoded.modules.length / encoded.text.length
            return (
              <text key={i} x={encoded.quietLeft + cell * i + cell / 2} y={height - 1}>
                {char}
              </text>
            )
          })}
        </g>
      ) : null}
    </svg>
  )
}
