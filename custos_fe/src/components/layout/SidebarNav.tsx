"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Wallet,
  Receipt,
  ClipboardList,
  Puzzle,
  Settings,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/payees", label: "Payees", icon: Building2 },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/review-queue", label: "Review Queue", icon: ClipboardList },
  { href: "/templates", label: "Agent Templates", icon: Puzzle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link href="/overview" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <span className="text-lg">Custos</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/overview" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
