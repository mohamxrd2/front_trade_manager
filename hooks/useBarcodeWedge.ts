'use client'

import * as React from 'react'

/**
 * Douchette USB/Bluetooth : elle se présente comme un clavier qui tape le
 * code très vite puis Entrée. On la reconnaît à la vitesse (≥ `minLength`
 * caractères, moins de `maxIntervalMs` entre chaque) — une personne ne tape
 * pas 6 touches en moins de 50 ms chacune. Seulement quand aucun champ n'a
 * le focus : dans un champ, la frappe reste au champ (la recherche traite
 * elle-même un code suivi d'Entrée).
 */

export interface WedgeOptions {
  minLength?: number
  maxIntervalMs?: number
}

export const WEDGE_MIN_LENGTH = 6
export const WEDGE_MAX_INTERVAL_MS = 50

/** Cœur sans React ni DOM (testé) : renvoie le code quand une saisie rapide se termine par Entrée. */
export function createWedgeDetector({ minLength = WEDGE_MIN_LENGTH, maxIntervalMs = WEDGE_MAX_INTERVAL_MS }: WedgeOptions = {}) {
  let buffer = ''
  let lastAt = -Infinity

  return {
    /** Une touche ; `null`, ou le code lu si c'est l'Entrée qui clôt une saisie de douchette. */
    key(key: string, at: number): string | null {
      const fast = at - lastAt <= maxIntervalMs
      if (key === 'Enter') {
        const code = fast && buffer.length >= minLength ? buffer : null
        buffer = ''
        lastAt = -Infinity
        return code
      }
      if (key.length !== 1) {
        // Maj, Ctrl… envoyées par certaines douchettes : sans effet sur le code.
        if (key !== 'Shift') {
          buffer = ''
          lastAt = -Infinity
        }
        return null
      }
      buffer = fast ? buffer + key : key
      lastAt = at
      return null
    },
    reset() {
      buffer = ''
      lastAt = -Infinity
    },
  }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (target as HTMLInputElement).type
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(type)
}

export function useBarcodeWedge(onScan: (code: string) => void, { enabled = true, ...options }: WedgeOptions & { enabled?: boolean } = {}) {
  const onScanRef = React.useRef(onScan)
  React.useLayoutEffect(() => {
    onScanRef.current = onScan
  })
  const { minLength, maxIntervalMs } = options

  React.useEffect(() => {
    if (!enabled) return
    const detector = createWedgeDetector({ minLength, maxIntervalMs })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target) || isEditableTarget(document.activeElement)) {
        detector.reset()
        return
      }
      const code = detector.key(event.key, performance.now())
      if (code) {
        event.preventDefault()
        event.stopPropagation()
        onScanRef.current(code)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled, minLength, maxIntervalMs])
}
