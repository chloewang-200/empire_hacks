"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Building2, Receipt, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/review-queue", label: "Review Queue", icon: ShieldAlert },
  { href: "/admin/transactions", label: "Transactions", icon: Receipt },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link
          href="/admin/review-queue"
          className="group flex items-center gap-2 font-semibold text-sidebar-foreground transition-colors hover:text-foreground"
        >
          <span className="text-lg">Custos Admin</span>
          <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin/clients" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <ArrowUpRight
                className={cn(
                  "h-4 w-4 shrink-0 transition-all",
                  isActive
                    ? "opacity-100"
                    : "opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100"
                )}
              />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
