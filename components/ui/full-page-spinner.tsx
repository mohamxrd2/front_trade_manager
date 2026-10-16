import { Loader2 } from 'lucide-react'

/** Spinner plein écran — seul indicateur de chargement affiché entre deux pages (auth, onboarding, OAuth) ; couleur de marque Waelly, jamais la couleur par défaut du thème shadcn. */
export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="size-9 animate-spin text-[#5B3FE6]" />
    </div>
  )
}
