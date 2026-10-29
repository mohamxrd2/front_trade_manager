import * as React from 'react'

/**
 * `true` à partir de 1024px (breakpoint `lg`, même seuil que glass-sidebar/
 * BottomTabBar) — à utiliser pour choisir EXCLUSIVEMENT entre deux
 * composants basés sur un portail (Drawer/Sheet/Dialog) selon la taille
 * d'écran. Un simple wrapper `className="lg:hidden"` / `"hidden lg:block"`
 * ne suffit PAS pour ça : Radix (Dialog/Sheet) et vaul (Drawer) portent
 * leur contenu directement dans `document.body`, hors de l'arbre DOM du
 * wrapper — les DEUX restent donc montés et interactifs en même temps,
 * quelle que soit la largeur d'écran, d'où des champs/boutons dupliqués.
 */
export function useIsDesktop(breakpointPx = 1024): boolean {
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpointPx}px)`)
    const onChange = () => setIsDesktop(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [breakpointPx])

  return isDesktop
}
