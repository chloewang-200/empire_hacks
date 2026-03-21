"use client";

import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminAccountMenu } from "./AdminAccountMenu";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";

export function AdminTopbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <AdminBreadcrumbs />
      <div className="flex items-center gap-3">
        <Badge variant="warning" className="hidden sm:inline-flex">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Admin Console
        </Badge>
        <AdminAccountMenu />
      </div>
    </header>
  );
}
