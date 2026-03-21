"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getWallets } from "@/lib/api/wallets";
import { WalletStatusBadge } from "@/components/status/StatusBadge";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletFormDialog } from "@/components/wallets/WalletFormDialog";

export default function WalletsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["wallets", { page: 1, pageSize: 50 }],
    queryFn: () => getWallets({ page: 1, pageSize: 50 }),
  });

  const wallets = data?.data ?? [];
  const filtered = search
    ? wallets.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    : wallets;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">Wallets</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Governed spending containers. Set policies and assign agents.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add wallet
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search wallets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "No wallets match" : "No wallets yet"}
            description={search ? "Try a different search." : "Create a wallet to get started."}
            action={!search && <Button onClick={() => setFormOpen(true)}>Add wallet</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Daily limit</TableHead>
                <TableHead>Per-tx limit</TableHead>
                <TableHead>Agents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((wallet) => (
                <TableRow
                  key={wallet.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/wallets/${wallet.id}`)}
                >
                  <TableCell className="font-medium">{wallet.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(wallet.balance, wallet.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {wallet.policy?.limits?.daily != null
                      ? formatCurrency(wallet.policy.limits.daily, wallet.currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {wallet.policy?.limits?.perTransaction != null
                      ? formatCurrency(wallet.policy.limits.perTransaction, wallet.currency)
                      : "—"}
                  </TableCell>
                  <TableCell>{wallet.assignedAgentsCount}</TableCell>
                  <TableCell>
                    <WalletStatusBadge status={wallet.status} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/wallets/${wallet.id}`)}>
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/wallets/${wallet.id}/edit`)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/wallets/${wallet.id}?fund=1`)}>
                          Add funds
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <WalletFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
