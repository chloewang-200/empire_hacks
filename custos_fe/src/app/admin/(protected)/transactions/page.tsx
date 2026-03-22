"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { getAdminTransactions } from "@/lib/api/adminTransactions";
import { transactionNeedsAdminReview } from "@/lib/adminTransactionReview";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { PolicyResultBadge, TransactionStatusBadge } from "@/components/status/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";

function AdminTransactionsPageFallback() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function AdminTransactionsPageContent() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-transactions"],
    retry: false,
    queryFn: () =>
      getAdminTransactions({
        page: 1,
        pageSize: 100,
      }),
  });

  const transactions = data?.data ?? [];

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return transactions;

    return transactions.filter((transaction) =>
      [
        transaction.id,
        transaction.vendor,
        transaction.recipient,
        transaction.agentName,
        transaction.walletName,
        transaction.memo,
        transaction.purpose,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [search, transactions]);

  const reviewCount = transactions.filter((transaction) => transactionNeedsAdminReview(transaction)).length;
  const settledCount = transactions.filter((transaction) => transaction.status === "settled").length;
  const walletCount = new Set(transactions.map((transaction) => transaction.walletId)).size;

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-heading-1 text-foreground">All Transactions</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Cross-workspace ledger for every agent-initiated spend request, with fast paths into the
            manual review experience.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/review-queue">
            Open review queue
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="admin-card-link">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
              <Receipt className="h-4 w-4" />
              Transactions
            </CardDescription>
            <CardTitle className="text-3xl">{transactions.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Recent transaction requests across all connected workspaces.
          </CardContent>
        </Card>
        <Card className="admin-card-link">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
              <ShieldAlert className="h-4 w-4" />
              Needs Review
            </CardDescription>
            <CardTitle className="text-3xl">{reviewCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Transactions currently held for manual inspection or override.
          </CardContent>
        </Card>
        <Card className="admin-card-link">
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
              <Wallet className="h-4 w-4" />
              Wallet Coverage
            </CardDescription>
            <CardTitle className="text-3xl">{walletCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Wallets represented in this slice, with {settledCount} already settled.
          </CardContent>
        </Card>
      </div>

      <Card className="admin-card-link">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Ledger search</CardTitle>
          <CardDescription>
            Search by vendor, transaction ID, agent, wallet, or recorded purpose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transactions"
            className="max-w-xl"
          />
        </CardContent>
      </Card>

      <Card className="admin-card-link overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Ledger</CardTitle>
          <CardDescription>
            Open any transaction in the admin reviewer to inspect the audit trail and record a
            decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load transactions."}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState
              title="No transactions"
              description="Once agents submit spend requests, they will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id} className="admin-table-row">
                    <TableCell>
                      <div className="space-y-2">
                        <Link
                          href={`/admin/transactions/${transaction.id}`}
                          className="admin-link"
                        >
                          {transaction.vendor ?? transaction.recipient ?? "Unknown vendor"}
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(transaction.amount, transaction.currency)} ·{" "}
                          {formatDateTime(transaction.requestedAt)}
                        </p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {transaction.purpose ?? transaction.memo ?? "No agent purpose recorded."}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{transaction.agentName}</TableCell>
                    <TableCell>{transaction.walletName}</TableCell>
                    <TableCell>
                      <TransactionStatusBadge status={transaction.status} />
                    </TableCell>
                    <TableCell>
                      {transaction.policyResult ? (
                        <PolicyResultBadge result={transaction.policyResult} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" asChild>
                          <Link href={`/transactions?tx=${transaction.id}`}>Workspace view</Link>
                        </Button>
                        <Button asChild>
                          <Link href={`/admin/transactions/${transaction.id}`}>
                            Review
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
