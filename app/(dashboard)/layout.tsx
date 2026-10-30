"use client"

import { useQuery } from "@tanstack/react-query"

import { usePathname } from "next/navigation"

import ProtectedRoute from "@/components/ProtectedRoute"
import { PermissionGuard } from "@/components/PermissionGuard"
import { requiredPermissionsFor } from "@/lib/permissions/route-permissions"
import { OnboardingGuard } from "@/components/onboarding/onboarding-guard"
import { ConnectionIndicator } from "@/components/connection-indicator"
import { GlassSidebar } from "@/components/waelly"
import { BottomTabBar } from "@/components/navigation/BottomTabBar"
import { TabPageTransition } from "@/components/navigation/TabPageTransition"
import { useAuth } from "@/contexts/AuthContext"
import { AmountVisibilityProvider } from "@/contexts/AmountVisibilityContext"
import { useNotifications } from "@/hooks/useNotifications"
import { useArticles } from "@/lib/hooks/useArticles"
import { usePermissions } from "@/hooks/usePermissions"
import { useIsAppBusy } from "@/components/navigation-progress-bar"
import { useTabScrollRestoration } from "@/hooks/useTabScrollRestoration"
import { getCompany } from "@/lib/services/company"
import { keys } from "@/lib/query-keys"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ProtectedRoute AVANT tout hook qui appelle l'API (notifications,
  // articles, entreprise) : tant que la session n'est pas confirmée — ou
  // qu'un membre doit encore changer son code (must_change_password, tout
  // sauf /api/me/change-code renvoie 403) — aucune requête ne doit partir.
  return (
    <ProtectedRoute>
      <DashboardShell>{children}</DashboardShell>
    </ProtectedRoute>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  // Même hook (même clé TanStack Query ['products','list']) que la page
  // Stock : aucun appel réseau supplémentaire, juste un second abonné au cache.
  // Pas de stock.view (ex. comptable) : le backend refuserait (403).
  const { can } = usePermissions()
  const { articles } = useArticles({ enabled: can("stock.view") })
  const isBusy = useIsAppBusy()
  const requiredPermissions = requiredPermissionsFor(usePathname())
  const stockAlerts = articles.filter((article) => article.low_stock).length

  // Même clé que Settings > Entreprise (keys.settings.company()) : cache déjà
  // chaud si l'utilisateur est passé par Paramètres, sinon un seul fetch ici.
  const { data: company } = useQuery({
    queryKey: keys.settings.company(),
    queryFn: getCompany,
    staleTime: 30 * 60 * 1000,
  })

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "?"

  // Une seule fois ici (layout jamais démonté) : si c'était dans chaque
  // page, la position de défilement serait perdue à chaque changement d'onglet.
  useTabScrollRestoration()

  return (
    <OnboardingGuard>
      <div className="bg-canvas min-h-screen lg:bg-desktop">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-start gap-5 p-5">
          <div className="sticky top-5 hidden max-h-[calc(100vh-40px)] lg:block lg:flex-[1_1_240px]">
            <GlassSidebar
              user={{
                initials,
                name: user ? `${user.first_name} ${user.last_name}` : "",
                company: user?.email,
                logoUrl: company?.logo_url,
                role: user?.is_owner ? null : (user?.role ?? null),
              }}
              unreadNotifications={unreadCount}
              stockAlerts={stockAlerts}
              onLogout={logout}
            />
          </div>
          <main className="min-w-0 flex-[999_1_560px] pb-nav-safe md:pb-6" aria-busy={isBusy}>
            <AmountVisibilityProvider>
              <TabPageTransition>
                {requiredPermissions ? (
                  <PermissionGuard permission={requiredPermissions}>{children}</PermissionGuard>
                ) : (
                  children
                )}
              </TabPageTransition>
            </AmountVisibilityProvider>
          </main>
        </div>
      </div>
      <BottomTabBar />
      <ConnectionIndicator />
    </OnboardingGuard>
  )
}
