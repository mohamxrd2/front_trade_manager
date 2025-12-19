"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconInnerShadowTop,
  IconListDetails,
  IconSettings,
  IconUsers,
  IconBell,
} from "@tabler/icons-react"

import { useAuth } from "@/contexts/AuthContext"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useTranslation } from "@/lib/i18n/hooks/useTranslation"
import { useNotifications } from "@/hooks/useNotifications"
import Link from "next/link"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const getNavData = (t: (key: string) => string) => ({
  navMain: [
    {
      title: t("nav.dashboard"),
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: t("nav.analytics"),
      url: "/analytics",
      icon: IconChartBar,
    },
    {
      title: t("nav.transactions"),
      url: "/wallet",
      icon: IconDatabase,
    },
   
    {
      title: t("nav.products"),
      url: "/products",
      icon: IconListDetails,
    },
    {
      title: t("nav.collaborators"),
      url: "/collaborators",
      icon: IconUsers,
    },
    {
      title: t("nav.notifications"),
      url: "/notifications",
      icon: IconBell,
    },
   
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "/capture",
      items: [
        {
          title: "Active Proposals",
          url: "/capture/proposals",
        },
        {
          title: "Archived",
          url: "/capture/archived",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "/proposal",
      items: [
        {
          title: "Active Proposals",
          url: "/proposal/active",
        },
        {
          title: "Archived",
          url: "/proposal/archived",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "/prompts",
      items: [
        {
          title: "Active Proposals",
          url: "/prompts/active",
        },
        {
          title: "Archived",
          url: "/prompts/archived",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: t("nav.settings"),
      url: "/settings",
      icon: IconSettings,
    },
 
  ],

})

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, loading, isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const { unreadCount } = useNotifications()
  const data = getNavData(t)

  // Pendant le chargement, ne pas afficher de données fallback
  // Attendre que loading soit false avant d'afficher quoi que ce soit
  if (loading) {
    // Optionnel : afficher un état de chargement minimal
    const userData = {
      name: t('common.loading'),
      first_name: t('common.loading'),
      last_name: '',
      email: '',
      avatar: ''
    }
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:!p-1.5"
              >
                <Link href="/">
                  <IconInnerShadowTop className="!size-5" />
                  <span className="text-base font-semibold">Trade Manager</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
          <NavSecondary items={data.navSecondary} className="mt-auto" />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={userData} />
        </SidebarFooter>
      </Sidebar>
    )
  }

  // Vérifier que les données utilisateur sont complètes et que l'utilisateur est authentifié
  // IMPORTANT: Ne jamais afficher les valeurs par défaut si loading est true
  const hasValidUserData = !loading && 
    isAuthenticated && 
    user && 
    typeof user.first_name === 'string' && user.first_name.trim() !== '' &&
    typeof user.last_name === 'string' && user.last_name.trim() !== '' &&
    typeof user.email === 'string' && user.email.trim() !== ''

  // Données utilisateur - seulement afficher les vraies données si authentifié ET loading est false
  // Si loading est true, on est déjà sorti plus haut avec "Chargement..."
  const userData = hasValidUserData ? {
    name: `${user.first_name} ${user.last_name}`,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    avatar: user.profile_image || ' '
  } : {
    // Si on arrive ici et que loading est false, c'est qu'on n'est pas authentifié
    // On affiche des valeurs génériques (mais jamais pendant le chargement)
    name: t('common.loading'),
    first_name: t('common.loading'),
    last_name: '',
    email: '',
    avatar: ' '
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Trade Manager</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} unreadNotificationCount={unreadCount} />
        {/* <NavDocuments items={data.documents} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
