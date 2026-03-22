"use client";

import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { getAdminTransactions } from "@/lib/api/adminTransactions";
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
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { PolicyResultBadge } from "@/components/status/StatusBadge";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function AdminTransactionsPageFallback() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function AdminTransactionsPageContent() {
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-transactions", { status: statusFilter }],
    queryFn: () =>
      getAdminTransactions({
        page: 1,
        pageSize: 100,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const transactions = data?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">All Transactions (Admin)</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Cross-workspace view of all transactions from custos_be.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search (ID, vendor) — local only" className="max-w-sm" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions"
            description="Once agents submit spend requests, they will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-caption">{tx.id.slice(0, 12)}…</TableCell>
                  <TableCell className="text-body-sm text-muted-foreground">
                    {formatDateTime(tx.requestedAt)}
                  </TableCell>
                  <TableCell>{tx.agentName}</TableCell>
                  <TableCell>{tx.walletName}</TableCell>
                  <TableCell>{tx.vendor ?? tx.recipient ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(tx.amount, tx.currency)}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={tx.status} />
                  </TableCell>
                  <TableCell>
                    {tx.policyResult ? (
                      <PolicyResultBadge result={tx.policyResult} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/transactions?tx=${tx.id}`}>Open in workspace view</Link>
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
    </div>
  );
}

export default function AdminTransactionsPage() {
  return (
    <Suspense fallback={<AdminTransactionsPageFallback />}>
      <AdminTransactionsPageContent />
    </Suspense>
  );
}
