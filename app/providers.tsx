'use client'

import * as React from 'react'
import { defaultShouldDehydrateQuery, QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import packageJson from '@/package.json'
import { queryClient } from '@/lib/query-client'
import { NavigationProgressBar } from '@/components/navigation-progress-bar'

// NavigationProgressBar lit useSearchParams() (next/navigation), qui exige
// un Suspense englobant pour ne pas forcer tout l'arbre en rendu client pur.
function SuspendedProgressBar() {
  return (
    <React.Suspense fallback={null}>
      <NavigationProgressBar />
    </React.Suspense>
  )
}

/**
 * Règle d'affichage (appliquée page par page, voir chaque `useQuery`) :
 * - isPending && !data        → skeletons (premier chargement, rien en cache)
 * - data présent && isFetching → données actuelles affichées, PAS de skeleton
 * - isError && data           → on garde l'affichage + toast « Impossible d'actualiser »
 * - isError && !data          → message d'erreur + bouton Réessayer
 *
 * Le QueryClient lui-même vit dans lib/query-client.ts (singleton au niveau
 * module, pas ici) : lib/hooks/useCache.ts doit pouvoir y accéder hors d'un
 * composant React (invalidation depuis un simple gestionnaire d'événement).
 */

// Clé de version du cache persistant — invalide tout le cache stocké en
// localStorage si la version de l'app change (évite de restaurer un cache
// qui ne correspond plus à la forme des données attendue par le nouveau code).
const PERSIST_BUSTER = packageJson.version

// Pas de `localStorage` pendant le rendu serveur : un stockage no-op le
// remplace le temps du SSR. Le persister reste le MÊME type de composant
// (`createSyncStoragePersister`) des deux côtés — seul son backend de
// stockage diffère — pour que l'arbre React rendu soit identique sur le
// serveur et au moment de l'hydratation (brancher sur `typeof window` pour
// choisir entre deux providers différents causerait un mismatch
// d'hydratation : c'était le vrai bug ici, pas next-themes).
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [persister] = React.useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== 'undefined' ? window.localStorage : noopStorage,
      key: 'waelly-query-cache',
    })
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 h
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          // Ne jamais persister une query marquée `meta: { sensitive: true }`
          // (ex. tout ce qui toucherait à la sécurité du compte) — rien
          // dans l'app n'utilise ce flag aujourd'hui (aucune query de
          // paramètres de sécurité n'est mise en cache, le changement de mot
          // de passe est une mutation pure), mais le mécanisme est en place.
          shouldDehydrateQuery: (query) =>
            !query.meta?.sensitive && defaultShouldDehydrateQuery(query),
        },
      }}
    >
      <SuspendedProgressBar />
      {children}
      {process.env.NODE_ENV === 'development' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </PersistQueryClientProvider>
  )
}
