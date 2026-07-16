"use client"

import * as React from "react"
import { type Icon } from "@tabler/icons-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()
  const [mounted] = useState(() => typeof window !== 'undefined')

  if (!mounted) {
    return (
      <SidebarGroup {...props}>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild
                  className="transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Link href={item.url}>
                    <item.icon 
                      className="transition-colors duration-200 text-gray-500 dark:text-gray-400 h-4 w-4" 
                      strokeWidth={1.5}
                    />
                    <span className="text-sm">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild
                  className={cn(
                    "transition-all duration-200 ease-in-out",
                    isActive
                      ? "bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Link href={item.url}>
                    <item.icon 
                      className={cn(
                        "transition-colors duration-200 h-4 w-4",
                        isActive
                          ? "text-green-600 dark:text-green-300"
                          : "text-gray-500 dark:text-gray-400"
                      )}
                      strokeWidth={1.5}
                    />
                    <span className="text-sm">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
