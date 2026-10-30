"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Bell,
  FileText,
  Home,
  LogOut,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { usePermissions } from "@/hooks/usePermissions"
import { roleLabelKey } from "@/lib/permissions/role-labels"
import { isRouteAllowed } from "@/lib/permissions/route-permissions"
import { homeRouteForUser } from "@/lib/permissions/home-route"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Menu latéral en verre (ordinateur, ≥ 1024px) — reprend
 * design/maquettes/ordinateur/WebSidebar.dc.html à l'identique.
 */
interface GlassSidebarNavItem {
  href: string
  /** Clé de traduction (nav.*), pas le texte directement — résolu au rendu via t(). */
  labelKey: string
  icon: LucideIcon
  badge?: { count: number; tone: "danger" | "brand" }
  /** Permission requise pour voir cet item — absent = toujours visible (ex. Accueil, Notifications, Paramètres). */
  permission?: string
}

// "Mes ventes" n'apparaît que pour un membre SANS wallet.view_balance (le
// propriétaire/gérant ont déjà /wallet) — même logique que lib/tabs.ts.
export const ACTIVITY_ITEMS: GlassSidebarNavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: Home },
  { href: "/wallet", labelKey: "nav.mySales", icon: ShoppingCart },
  { href: "/products", labelKey: "nav.stock", icon: Package, permission: "stock.view" },
  { href: "/wallet", labelKey: "nav.wallet", icon: Wallet, permission: "wallet.view_balance" },
  { href: "/invoices", labelKey: "nav.invoices", icon: FileText, permission: "invoices.view" },
  { href: "/clients", labelKey: "nav.clients", icon: Users, permission: "invoices.view" },
  { href: "/analytics", labelKey: "nav.analytics", icon: BarChart3, permission: "analytics.view" },
]

export const ACCOUNT_ITEMS: GlassSidebarNavItem[] = [
  { href: "/team", labelKey: "nav.team", icon: Users, permission: "team.manage" },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
]

/**
 * Entrées du menu réellement affichées :
 * - « Mes opérations » seulement pour qui n'a PAS le Portefeuille complet
 *   (même logique que lib/tabs.ts) — les deux pointent vers /wallet ;
 * - la permission propre à l'entrée (ex. « Portefeuille » : wallet.view_balance) ;
 * - ET la garde des routes : jamais un lien vers une page refusée ;
 * - jamais deux entrées vers la même page.
 */
export function visibleNavItems(items: GlassSidebarNavItem[], can: (permission: string) => boolean): GlassSidebarNavItem[] {
  const hasWallet = can("wallet.view_balance")
  const seen = new Set<string>()
  return items.filter((item) => {
    if (item.labelKey === "nav.mySales" && (hasWallet || !(can("sales.view_own") || can("sales.view_all")))) return false
    if (item.permission && !can(item.permission)) return false
    if (!isRouteAllowed(item.href, can)) return false
    if (seen.has(item.href)) return false
    seen.add(item.href)
    return true
  })
}

interface GlassSidebarUser {
  initials: string
  name: string
  company?: string
  /** Logo entreprise (Paramètres > Entreprise ou onboarding, étape 2) — affiché à la place des initiales quand présent. */
  logoUrl?: string | null
  /** Rôle du membre connecté — `null`/absent pour le propriétaire (badge "role" masqué, voir plus bas). */
  role?: string | null
}

interface GlassSidebarProps {
  user: GlassSidebarUser
  stockAlerts?: number
  unreadNotifications?: number
  onLogout?: () => void
  className?: string
}

function NavLink({
  item,
  active,
  label,
}: {
  item: GlassSidebarNavItem
  active: boolean
  label: string
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-1 basis-[200px] items-center gap-3 rounded-2xl px-3 text-sm",
        active ? "glass-active" : "font-semibold text-ink-2"
      )}
    >
      <Icon className="size-5" strokeWidth={1.8} />
      {label}
      {item.badge ? (
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
            item.badge.tone === "danger"
              ? "bg-danger-dot text-white"
              : "bg-brand-100 text-brand-700"
          )}
        >
          {item.badge.count}
        </span>
      ) : null}
    </Link>
  )
}

function GlassSidebar({
  user,
  stockAlerts,
  unreadNotifications,
  onLogout,
  className,
}: GlassSidebarProps) {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { can, role, isOwner, permissions } = usePermissions()
  // Logo → accueil du rôle (le gestionnaire de stock n'a pas de tableau de bord).
  const homeHref = homeRouteForUser({ is_owner: isOwner, role, permissions })
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false)

  const canSell = can("sales.create")

  const activityItems = visibleNavItems(ACTIVITY_ITEMS, can)
    .map((item) =>
      item.href === "/products" && stockAlerts
        ? { ...item, badge: { count: stockAlerts, tone: "danger" as const } }
        : item
    )
  const accountItems = visibleNavItems(ACCOUNT_ITEMS, can).map((item) =>
    item.href === "/notifications" && unreadNotifications
      ? { ...item, badge: { count: unreadNotifications, tone: "danger" as const } }
      : item
  )

  return (
    <aside
      aria-label={t('nav.menu')}
      data-slot="waelly-glass-sidebar"
      className={cn(
        "glass-panel hidden h-full w-full flex-col gap-4.5 overflow-y-auto rounded-hero p-3.5 lg:flex",
        className
      )}
    >
      <Link href={homeHref} className="flex items-center gap-2.5 px-2">
        <span className="flex size-[38px] items-center justify-center rounded-xl bg-orb text-[19px] font-extrabold text-white">
          W
        </span>
        <span className="text-xl font-extrabold tracking-tight text-ink">
          Waelly
        </span>
      </Link>

      {canSell ? (
        <Link
          href="/wallet/new?type=sale"
          className="flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-button text-sm font-bold text-white shadow-button"
        >
          <Plus className="size-[18px]" strokeWidth={2.2} />
          {t('nav.newSale')}
        </Link>
      ) : null}

      <nav aria-label={t('nav.mainNav')} className="flex flex-wrap gap-0.5">
        <span className="basis-full px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-subtle">
          {t('nav.activitySection')}
        </span>
        {activityItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} label={t(item.labelKey)} />
        ))}

        <span className="basis-full px-3 pb-1 pt-3.5 text-[11px] font-bold uppercase tracking-wide text-subtle">
          {t('nav.accountSection')}
        </span>
        {accountItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} label={t(item.labelKey)} />
        ))}
      </nav>

      <div className="glass flex items-center gap-2.5 rounded-tile p-3">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white">
          {user.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi par le backend (storage/public), pas next/image
            <img src={user.logoUrl} alt="" className="size-full object-cover" />
          ) : (
            user.initials
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
            <span className="truncate">{user.name}</span>
            {/* "Koffi · Caissier" — badge de rôle, absent pour le propriétaire (section 6 du chantier "Équipe"). */}
            {user.role ? (
              <span className="shrink-0 text-xs font-semibold text-subtle">· {t(roleLabelKey(user.role))}</span>
            ) : null}
          </span>
          {user.company ? (
            <span className="truncate text-xs text-subtle">{user.company}</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => setLogoutDialogOpen(true)}
          aria-label={t('nav.logout')}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-3"
        >
          <LogOut className="size-[18px]" strokeWidth={1.9} />
        </button>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('nav.logoutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('nav.logoutConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLogoutDialogOpen(false)
                onLogout?.()
              }}
            >
              {t('nav.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

export { GlassSidebar }
export type { GlassSidebarProps, GlassSidebarUser, GlassSidebarNavItem }
