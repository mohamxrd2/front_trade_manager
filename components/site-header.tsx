'use client'

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"

export function SiteHeader() {
  const pathname = usePathname()

  // Fonction pour obtenir le titre basé sur la route
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/dashboard':
        return 'Dashboard'
      case '/analytics':
        return 'Statistiques'
      case '/wallet':
        return 'Transactions'
      case '/products':
        return 'Produits'
      case '/collaborators':
        return 'Collaborateurs'
      default:
        return 'Dashboard'
    }
  }
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{getPageTitle(pathname)}</h1>
       
      </div>
    </header>
  )
}
