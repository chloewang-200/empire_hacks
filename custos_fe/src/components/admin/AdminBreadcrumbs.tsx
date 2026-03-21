"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const labels: Record<string, string> = {
  admin: "Admin",
  companies: "Companies",
  agents: "Agents",
  transactions: "Transactions",
  login: "Login",
};

export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => ({
    label: labels[segment] ?? segment,
    href: "/" + segments.slice(0, index + 1).join("/"),
  }));

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/admin/companies" className="text-muted-foreground hover:text-foreground">
        Custos
      </Link>
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-muted-foreground hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
