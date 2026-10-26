'use client'

import * as React from 'react'

/**
 * Renvoie `value`, mais mis à jour seulement `delayMs` après la dernière
 * modification — utilisé par la barre de recherche du Portefeuille (300 ms)
 * pour ne pas relancer une requête à chaque frappe.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
