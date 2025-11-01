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

} from "@tabler/icons-react"

import { useAuth } from "@/context/AuthContext"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Statistiques",
      url: "/analytics",
      icon: IconChartBar,
    },
    {
      title: "Transactions",
      url: "/wallet",
      icon: IconDatabase,
    },
   
    {
      title: "Produits",
      url: "/products",
      icon: IconListDetails,
    },
    {
      title: "Collaborateurs",
      url: "/collaborators",
      icon: IconUsers,
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
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
    // {
    //   title: "Reports",
    //   url: "/reports",
    //   icon: IconReport,
    // },
    // {
    //   title: "Customers",
    //   url: "/customers",
    //   icon: IconUsers,
    // },
  ],
  // documents: [
  //   {
  //     name: "Data Library",
  //     url: "/data-library",
  //     icon: IconDatabase,
  //   },
  //   {
  //     name: "Reports",
  //     url: "/reports",
  //     icon: IconReport,
  //   },
  //   {
  //     name: "Word Assistant",
  //     url: "/word-assistant",
  //     icon: IconFileWord,
  //   },
  // ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()

  // Données utilisateur par défaut si pas connecté
  const userData = user ? {
    name: `${user.first_name} ${user.last_name}`,
    email: user.email,
    avatar: user.profile_image || '/avatars/default-avatar.jpg'
  } : {
    name: 'Utilisateur',
    email: 'user@example.com',
    avatar: '/avatars/default-avatar.jpg'
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
        {/* <NavDocuments items={data.documents} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
