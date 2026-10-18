import { BarChart3, FileText, Home, Package, Wallet, type LucideIcon } from 'lucide-react'

/**
 * Source de vérité unique pour la barre d'onglets mobile
 * (components/navigation/BottomTabBar.tsx) — maquette
 * design/maquettes/mobile/Main.dc.html, bas de l'écran.
 */
export interface TabDefinition {
  id: string
  label: string
  href: string
  icon: LucideIcon
  /** Routes additionnelles qui doivent aussi allumer cet onglet (ex. /clients → Factures). */
  activeMatch?: RegExp
}

export const TABS: TabDefinition[] = [
  { id: 'home', label: 'Accueil', href: '/dashboard', icon: Home },
  { id: 'stock', label: 'Stock', href: '/products', icon: Package },
  { id: 'wallet', label: 'Portefeuille', href: '/wallet', icon: Wallet },
  {
    id: 'invoices',
    label: 'Factures',
    href: '/invoices',
    icon: FileText,
    // Les clients font partie de la facturation (pas d'onglet dédié).
    activeMatch: /^\/clients(\/|$)/,
  },
  { id: 'analytics', label: 'Analyses', href: '/analytics', icon: BarChart3 },
]

/**
 * Écrans de détail/formulaire : la barre flottante gênerait leur propre
 * barre d'action fixe en bas. /settings, /collaborators et /notifications
 * n'ont pas d'onglet dédié (accès via l'engrenage/l'avatar/la cloche de
 * l'Accueil, design/DESIGN.md § 10) : pas de barre non plus sur ces pages.
 */
export const TAB_BAR_HIDDEN_ON: RegExp[] = [
  /^\/products\/[^/]+$/,
  /^\/wallet\/new$/,
  /^\/clients\/[^/]+$/,
  // /invoices/new ET /invoices/<id> : la barre flottante couvrait les
  // boutons d'action (PDF, Dupliquer, Marquer payée) en bas de page, qui ne
  // sont pas dans une barre fixe propre à cet écran comme sur les autres
  // pages de détail (ex. /products/<id>).
  /^\/invoices\/[^/]+$/,
  /^\/settings$/,
  /^\/collaborators$/,
  /^\/notifications$/,
]

export function isTabBarHidden(pathname: string | null): boolean {
  if (!pathname) return false
  return TAB_BAR_HIDDEN_ON.some((pattern) => pattern.test(pathname))
}

export function resolveActiveTabIndex(pathname: string | null): number {
  if (!pathname) return -1
  return TABS.findIndex(
    (tab) =>
      pathname === tab.href ||
      pathname.startsWith(`${tab.href}/`) ||
      (tab.activeMatch?.test(pathname) ?? false)
  )
}
