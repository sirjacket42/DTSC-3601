"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Gauge, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Gauge },
  { href: "/drivers", label: "Drivers", icon: Users },
  { href: "/schedule", label: "Schedule", icon: MapPin },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Flag className="size-4" />
        </div>
        <span className="font-heading text-sm font-semibold text-sidebar-foreground">
          F1 Dashboard
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
