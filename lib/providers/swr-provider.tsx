'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

/**
 * Provider SWR global
 * Configuration simple pour SWR
 */
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Configuration simple par défaut
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}

