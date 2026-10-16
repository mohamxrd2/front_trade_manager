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
  Users,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
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
  label: string
  icon: LucideIcon
  badge?: { count: number; tone: "danger" | "brand" }
}

const ACTIVITY_ITEMS: GlassSidebarNavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: Home },
  { href: "/products", label: "Stock", icon: Package },
  { href: "/wallet", label: "Portefeuille", icon: Wallet },
  { href: "/invoices", label: "Factures", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/analytics", label: "Analyses", icon: BarChart3 },
]

const ACCOUNT_ITEMS: GlassSidebarNavItem[] = [
  { href: "/collaborators", label: "Collaborateurs", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Paramètres", icon: Settings },
]

interface GlassSidebarUser {
  initials: string
  name: string
  company?: string
  /** Logo entreprise (Paramètres > Entreprise ou onboarding, étape 2) — affiché à la place des initiales quand présent. */
  logoUrl?: string | null
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
}: {
  item: GlassSidebarNavItem
  active: boolean
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
      {item.label}
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
  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)
  const [logoutDialogOpen, setLogoutDialogOpen] = React.useState(false)

  const activityItems = ACTIVITY_ITEMS.map((item) =>
    item.href === "/products" && stockAlerts
      ? { ...item, badge: { count: stockAlerts, tone: "danger" as const } }
      : item
  )
  const accountItems = ACCOUNT_ITEMS.map((item) =>
    item.href === "/notifications" && unreadNotifications
      ? { ...item, badge: { count: unreadNotifications, tone: "danger" as const } }
      : item
  )

  return (
    <aside
      aria-label="Menu"
      data-slot="waelly-glass-sidebar"
      className={cn(
        "glass-panel hidden h-full w-full flex-col gap-4.5 overflow-y-auto rounded-hero p-3.5 lg:flex",
        className
      )}
    >
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2">
        <span className="flex size-[38px] items-center justify-center rounded-xl bg-orb text-[19px] font-extrabold text-white">
          W
        </span>
        <span className="text-xl font-extrabold tracking-tight text-ink">
          Waelly
        </span>
      </Link>

      <Link
        href="/wallet/new?type=sale"
        className="flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-button text-sm font-bold text-white shadow-button"
      >
        <Plus className="size-[18px]" strokeWidth={2.2} />
        Nouvelle vente
      </Link>

      <nav aria-label="Navigation principale" className="flex flex-wrap gap-0.5">
        <span className="basis-full px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-subtle">
          Activité
        </span>
        {activityItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <span className="basis-full px-3 pb-1 pt-3.5 text-[11px] font-bold uppercase tracking-wide text-subtle">
          Compte
        </span>
        {accountItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
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
          <span className="truncate text-sm font-bold text-ink">
            {user.name}
          </span>
          {user.company ? (
            <span className="truncate text-xs text-subtle">{user.company}</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => setLogoutDialogOpen(true)}
          aria-label="Se déconnecter"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-3"
        >
          <LogOut className="size-[18px]" strokeWidth={1.9} />
        </button>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Se déconnecter ?</AlertDialogTitle>
            <AlertDialogDescription>Vous devrez vous reconnecter pour accéder à votre compte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLogoutDialogOpen(false)
                onLogout?.()
              }}
            >
              Se déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}

export { GlassSidebar }
export type { GlassSidebarProps, GlassSidebarUser, GlassSidebarNavItem }
