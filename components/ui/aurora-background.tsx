"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <main>
      <div
        className={cn(
          "relative flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-900 text-slate-950 transition-bg",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "absolute -inset-[10px] opacity-50 will-change-transform pointer-events-none",
              "bg-gradient-to-r from-blue-500 via-indigo-300 to-violet-200",
              "animate-aurora",
              "filter blur-[10px] invert dark:invert-0",
              showRadialGradient && "mask-[radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]"
            )}
          />
        </div>
        {children}
      </div>
    </main>
  );
};