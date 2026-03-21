"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wallet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletStatusBadge } from "@/components/status/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import type { Wallet as WalletType } from "@/lib/types";
import { WalletFormDialog } from "@/components/wallets/WalletFormDialog";
import { useState } from "react";

interface WalletsOverviewSectionProps {
  wallets: WalletType[];
  isLoading: boolean;
}

export function WalletsOverviewSection({ wallets, isLoading }: WalletsOverviewSectionProps) {
  const router = useRouter();
  const [addWalletOpen, setAddWalletOpen] = useState(false);
  const hasWallets = wallets.length > 0;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Wallets</h2>
          {hasWallets && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/wallets">View all</Link>
            </Button>
          )}
        </div>
        <div className="p-4">
          {!hasWallets ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-foreground">
                No wallets yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a governed spending container. Set limits, categories, and assign agents.
              </p>
              <Button
                className="mt-6"
                size="lg"
                onClick={() => setAddWalletOpen(true)}
              >
                <Plus className="mr-2 h-5 w-5" />
                Add your first wallet
              </Button>
            </div>
          ) : (
            <ul className="space-y-0">
              {wallets.slice(0, 6).map((wallet) => (
                <li key={wallet.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/wallets/${wallet.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {wallet.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {wallet.currency}
                        {wallet.assignedAgentsCount > 0 && ` · ${wallet.assignedAgentsCount} agents`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(wallet.balance, wallet.currency)}
                      </span>
                      <WalletStatusBadge status={wallet.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasWallets && wallets.length > 6 && (
            <div className="mt-2 border-t border-border pt-2">
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/wallets">View all {wallets.length} wallets</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <WalletFormDialog open={addWalletOpen} onOpenChange={setAddWalletOpen} />
    </>
  );
}
