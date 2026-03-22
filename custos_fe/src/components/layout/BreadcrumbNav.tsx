"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const labels: Record<string, string> = {
  overview: "Overview",
  agents: "Agents",
  wallets: "Wallets",
  transactions: "Transactions",
  "review-queue": "Review Queue",
  templates: "Agent Templates",
  payees: "Payees",
  invoice: "Invoice Agent",
  "event-production": "Event payouts",
  settings: "Settings",
};

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, i) => ({
    label: labels[segment] ?? segment,
    href: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        href="/overview"
        className="text-muted-foreground hover:text-foreground"
      >
        Custos
      </Link>
      {breadcrumbs.map((b, i) => (
        <span key={b.href} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {i === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">{b.label}</span>
          ) : (
            <Link
              href={b.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {b.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
