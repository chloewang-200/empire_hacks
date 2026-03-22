"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTransactions } from "@/lib/api/transactions";
import { effectivePolicyDisplay, payoutStatusLabel } from "@/lib/transactionDisplay";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { PolicyResultBadge } from "@/components/status/StatusBadge";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";

function TransactionsPageFallback() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 max-w-sm flex-1" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function TransactionsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") ?? "all"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const txFromUrl = searchParams.get("tx");
  useEffect(() => {
    if (txFromUrl) setSelectedId(txFromUrl);
  }, [txFromUrl]);

  function handleDetailOpenChange(open: boolean) {
    if (open) return;
    setSelectedId(null);
    if (!searchParams.get("tx")) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("tx");
    const q = sp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "transactions",
      { page: 1, pageSize: 50, status: statusFilter === "all" ? undefined : statusFilter },
    ],
    retry: false,
    queryFn: () =>
      getTransactions({
        page: 1,
        pageSize: 50,
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const transactions = data?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Transactions</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Operational ledger of agent-submitted transaction requests.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search..." className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load transactions."}
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions"
            description="Agent-submitted transactions will appear here."
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
              {transactions.map((tx) => {
                const payLbl = payoutStatusLabel(tx);
                const policyDisp = effectivePolicyDisplay(tx);
                return (
                <TableRow
                  key={tx.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedId(tx.id)}
                >
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
                    <div className="flex flex-col gap-0.5 items-end sm:items-start">
                      <TransactionStatusBadge status={tx.status} />
                      {payLbl && (
                        <span className="text-caption text-muted-foreground max-w-[14rem] text-right sm:text-left">
                          {payLbl}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!policyDisp ? (
                      "—"
                    ) : (
                      <div className="flex flex-col gap-1">
                        <PolicyResultBadge result={policyDisp.result} />
                        {policyDisp.subtitle && (
                          <span className="text-caption text-muted-foreground">{policyDisp.subtitle}</span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedId(tx.id)}>
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/review-queue?tx=${tx.id}`)}
                        >
                          Open in review queue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedId && (
        <TransactionDetailSheet
          transactionId={selectedId}
          open={!!selectedId}
          onOpenChange={handleDetailOpenChange}
        />
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsPageFallback />}>
      <TransactionsPageContent />
    </Suspense>
  );
}
