"use client";

import { Bell, Search } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { BreadcrumbNav } from "./BreadcrumbNav";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <BreadcrumbNav />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <AccountMenu />
      </div>
    </header>
  );
}
