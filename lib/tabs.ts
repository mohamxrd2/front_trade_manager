import { BarChart3, FileText, Home, Package, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react'
import type { User } from '@/lib/auth'
import { homeRouteForUser } from '@/lib/permissions/home-route'

/**
 * Source de vérité unique pour la barre d'onglets mobile
 * (components/navigation/BottomTabBar.tsx) — maquette
 * design/maquettes/mobile/Main.dc.html, bas de l'écran.
 *
 * Chantier "Équipe" étape 3 — la barre n'est plus statique : getTabs(user)
 * ne retourne que les onglets dont la permission est accordée (propriétaire
 * et gérant gardent la barre actuelle au complet). "Vente"/"Mes ventes"
 * n'apparaissent QUE pour un membre sans wallet.view_balance (qui n'a donc
 * pas les raccourcis du tableau de bord riche) — voir le commentaire sur
 * SALE_TAB/MY_SALES_TAB plus bas.
 */
export interface TabDefinition {
  id: string
  /** Clé de traduction (nav.*) — résolue au rendu via t(), voir BottomTabBar.tsx. */
  labelKey: string
  href: string
  icon: LucideIcon
  /** Routes additionnelles qui doivent aussi allumer cet onglet (ex. /clients → Factures). */
  activeMatch?: RegExp
}

const HOME_TAB = (href: string): TabDefinition => ({ id: 'home', labelKey: 'nav.home', href, icon: Home })
const SALE_TAB: TabDefinition = { id: 'sale', labelKey: 'nav.newSaleTab', href: '/wallet/new?type=sale', icon: ShoppingCart }
// Même page que le Portefeuille du gérant : le serveur n'y renvoie que SES opérations.
const MY_SALES_TAB: TabDefinition = { id: 'my-sales', labelKey: 'nav.mySales', href: '/wallet', icon: FileText }
const STOCK_TAB: TabDefinition = { id: 'stock', labelKey: 'nav.stock', href: '/products', icon: Package }
const WALLET_TAB: TabDefinition = { id: 'wallet', labelKey: 'nav.wallet', href: '/wallet', icon: Wallet }
const INVOICES_TAB: TabDefinition = {
  id: 'invoices',
  labelKey: 'nav.invoices',
  href: '/invoices',
  icon: FileText,
  // Les clients font partie de la facturation (pas d'onglet dédié).
  activeMatch: /^\/clients(\/|$)/,
}
const ANALYTICS_TAB: TabDefinition = { id: 'analytics', labelKey: 'nav.analytics', href: '/analytics', icon: BarChart3 }

/** Onglets "legacy" pour un utilisateur sans `permissions` (ex. tests, état transitoire au premier rendu) — comportement inchangé. */
export const TABS: TabDefinition[] = [HOME_TAB('/dashboard'), STOCK_TAB, WALLET_TAB, INVOICES_TAB, ANALYTICS_TAB]

/**
 * Barre calculée selon les permissions effectives de l'utilisateur. Exemple
 * caissier (sales.create, sales.view_own, stock.view — PAS
 * wallet.view_balance/invoices.view/analytics.view) : Caisse · Vente · Mes
 * ventes · Stock, exactement la spec.
 */
export function getTabs(user: User | null | undefined): TabDefinition[] {
  if (!user) return TABS

  const can = (p: string) => (user.permissions ?? []).includes(p)
  const hasWallet = can('wallet.view_balance')

  const tabs: TabDefinition[] = [HOME_TAB(homeRouteForUser(user))]

  // Un membre sans accès au Portefeuille global a besoin de ces deux
  // raccourcis dédiés (le propriétaire/gérant les ont déjà via le héros du
  // tableau de bord et /wallet lui-même).
  if (!hasWallet && can('sales.create')) tabs.push(SALE_TAB)
  if (!hasWallet && (can('sales.view_own') || can('sales.view_all'))) tabs.push(MY_SALES_TAB)

  if (can('stock.view')) tabs.push(STOCK_TAB)
  if (hasWallet) tabs.push(WALLET_TAB)
  if (can('invoices.view')) tabs.push(INVOICES_TAB)
  if (can('analytics.view')) tabs.push(ANALYTICS_TAB)

  // Dédoublonne par href (ex. gestionnaire de stock : l'accueil ET l'onglet
  // Stock pointeraient tous deux vers /products) — garde la première
  // occurrence (toujours l'accueil).
  const seenHrefs = new Set<string>()
  return tabs.filter((tab) => {
    const href = tab.href.split('?')[0]
    if (seenHrefs.has(href)) return false
    seenHrefs.add(href)
    return true
  })
}

/**
 * Écrans de détail/formulaire : la barre flottante gênerait leur propre
 * barre d'action fixe en bas. /settings, /team et /notifications n'ont pas
 * d'onglet dédié (accès via l'engrenage/l'avatar/la cloche de l'Accueil,
 * design/DESIGN.md § 10) : pas de barre non plus sur ces pages.
 */
export const TAB_BAR_HIDDEN_ON: RegExp[] = [
  /^\/products\/[^/]+$/,
  /^\/wallet\/new$/,
  // Formulaire « Ajouter une personne » en pleine page : comme la nouvelle vente.
  /^\/team\/new$/,
  /^\/clients\/[^/]+$/,
  // /invoices/new ET /invoices/<id> : la barre flottante couvrait les
  // boutons d'action (PDF, Dupliquer, Marquer payée) en bas de page, qui ne
  // sont pas dans une barre fixe propre à cet écran comme sur les autres
  // pages de détail (ex. /products/<id>).
  /^\/invoices\/[^/]+$/,
  /^\/settings$/,
  /^\/team$/,
  /^\/collaborators$/,
  /^\/notifications$/,
]

export function isTabBarHidden(pathname: string | null): boolean {
  if (!pathname) return false
  return TAB_BAR_HIDDEN_ON.some((pattern) => pattern.test(pathname))
}

export function resolveActiveTabIndex(pathname: string | null, tabs: TabDefinition[] = TABS): number {
  if (!pathname) return -1
  return tabs.findIndex(
    (tab) =>
      pathname === tab.href.split('?')[0] ||
      pathname.startsWith(`${tab.href.split('?')[0]}/`) ||
      (tab.activeMatch?.test(pathname) ?? false)
  )
}
