"use client";

import { type Icon } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
  unreadNotificationCount,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
  }[];
  unreadNotificationCount?: number;
}) {
  const pathname = usePathname();
  const [mounted] = useState(() => typeof window !== "undefined");

  if (!mounted) {
    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            {items.map((item) => {
              const isNotification = item.url === "/notifications";
              const showBadge =
                isNotification &&
                unreadNotificationCount !== undefined &&
                unreadNotificationCount > 0;

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild
                    className="transition-all duration-200 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Link href={item.url} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {item.icon && (
                          <item.icon
                            className="transition-colors duration-200 text-gray-500 dark:text-gray-400 h-4 w-4" 
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="text-sm">{item.title}</span>
                      </div>
                      {showBadge && (
                        <Badge
                          variant="destructive"
                          className="ml-2 h-5 min-w-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full flex-shrink-0"
                        >
                          {unreadNotificationCount! > 99
                            ? "99+"
                            : unreadNotificationCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url;
            const isNotification = item.url === "/notifications";
            const showBadge =
              isNotification &&
              unreadNotificationCount !== undefined &&
              unreadNotificationCount > 0;

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
                  <Link href={item.url} className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {item.icon && (
                        <item.icon 
                          className={cn(
                            "transition-colors duration-200 h-4 w-4",
                            isActive
                              ? "text-green-600 dark:text-green-300"
                              : "text-gray-500 dark:text-gray-400"
                          )}
                          strokeWidth={1.5}
                        />
                      )}
                      <span className="text-sm">{item.title}</span>
                    </div>
                    {showBadge && (
                      <Badge
                        variant="destructive"
                        className="ml-2 h-5 min-w-5 px-1.5 flex items-center justify-center text-xs font-bold rounded-full flex-shrink-0"
                      >
                        {unreadNotificationCount! > 99
                          ? "99+"
                          : unreadNotificationCount}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
