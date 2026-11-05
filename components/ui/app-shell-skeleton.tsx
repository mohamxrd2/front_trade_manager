/**
 * Squelettes affichés pendant la vérification de session / de permissions,
 * à la place d'un spinner plein écran : la page a déjà sa forme (barre
 * latérale + contenu) et paraît prête tout de suite. Même grille que
 * app/(dashboard)/layout.tsx.
 */
function ContentSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true">
      <div className="h-8 w-44 animate-pulse rounded bg-surface-soft" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[90px] animate-pulse rounded-card bg-surface-soft" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-tile bg-surface-soft" />
        ))}
      </div>
    </div>
  )
}

function AppShellSkeleton() {
  return (
    <div className="bg-canvas min-h-screen lg:bg-desktop" aria-busy="true">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-start gap-5 p-5">
        <div className="sticky top-5 hidden h-[calc(100vh-40px)] lg:block lg:flex-[1_1_240px]">
          <div className="glass-panel flex h-full w-full flex-col gap-4.5 rounded-hero p-3.5" aria-hidden="true">
            <div className="h-9 w-32 animate-pulse rounded bg-surface-soft" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-tile bg-surface-soft" />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-[999_1_560px]">
          <ContentSkeleton />
        </div>
      </div>
    </div>
  )
}

export { AppShellSkeleton, ContentSkeleton }
