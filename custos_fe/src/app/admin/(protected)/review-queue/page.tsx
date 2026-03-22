"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Receipt,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { getAdminTransactions } from "@/lib/api/adminTransactions";
import { getTransactionReviewReasons, transactionNeedsAdminReview } from "@/lib/adminTransactionReview";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { PolicyResultBadge, TransactionStatusBadge } from "@/components/status/StatusBadge";
import { Badge } from "@/components/ui/badge";
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

type FocusFilter = "all" | "decision" | "blocked";

function ReviewQueueFallback() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-2 h-4 w-[36rem] max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function QueueKpi({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  description: string;
}) {
  return (
    <Card className="admin-card-link bg-gradient-to-b from-background to-muted/20">
      <CardHeader className="pb-3">
        <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
          <Icon className="h-4 w-4" />
          {title}
        </CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  );
}

function ReviewQueuePageContent() {
  const [search, setSearch] = useState("");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-review-queue"],
    retry: false,
    queryFn: () => getAdminTransactions({ page: 1, pageSize: 100 }),
  });

  const transactions = data?.data ?? [];

  const flaggedTransactions = useMemo(
    () =>
      transactions.filter((transaction) => transactionNeedsAdminReview(transaction)).sort((a, b) => {
        const aBlocked = a.status === "blocked" ? 1 : 0;
        const bBlocked = b.status === "blocked" ? 1 : 0;
        if (aBlocked !== bBlocked) return bBlocked - aBlocked;
        return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
      }),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return flaggedTransactions.filter((transaction) => {
      if (focusFilter === "decision" && transaction.status !== "pending_review") return false;
      if (focusFilter === "blocked" && transaction.status !== "blocked") return false;

      if (!normalizedSearch) return true;

      const haystack = [
        transaction.id,
        transaction.vendor,
        transaction.recipient,
        transaction.agentName,
        transaction.walletName,
        transaction.purpose,
        transaction.memo,
        ...(transaction.riskFlags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [flaggedTransactions, focusFilter, search]);

  const pendingDecisions = flaggedTransactions.filter(
    (transaction) => transaction.status === "pending_review"
  ).length;
  const blockedTransactions = flaggedTransactions.filter(
    (transaction) => transaction.status === "blocked"
  ).length;
  const highRiskTransactions = flaggedTransactions.filter(
    (transaction) => (transaction.riskFlags?.length ?? 0) > 0
  ).length;

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-heading-1 text-foreground">Transaction Review Queue</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            Manual second-check flow for transactions that fall outside wallet policy. Review the
            agent&apos;s intent, audit trail, risk signals, and evidence before approving or
            rejecting spend.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/transactions">
            Open all transactions
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QueueKpi
          icon={Clock3}
          title="Pending Decisions"
          value={pendingDecisions}
          description="Transactions currently paused and waiting for an explicit admin call."
        />
        <QueueKpi
          icon={ShieldX}
          title="Blocked By Policy"
          value={blockedTransactions}
          description="Requests that failed controls and now need override-or-reject handling."
        />
        <QueueKpi
          icon={AlertTriangle}
          title="Risk Signals"
          value={highRiskTransactions}
          description="Requests where the agent emitted additional flags that deserve a closer read."
        />
      </div>

      <Card className="admin-card-link">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Queue controls</CardTitle>
          <CardDescription>
            Search by transaction ID, vendor, agent, wallet, or flagged reason.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search flagged transactions"
            className="max-w-xl"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant={focusFilter === "all" ? "default" : "outline"}
              onClick={() => setFocusFilter("all")}
            >
              All flagged
            </Button>
            <Button
              variant={focusFilter === "decision" ? "default" : "outline"}
              onClick={() => setFocusFilter("decision")}
            >
              Needs decision
            </Button>
            <Button
              variant={focusFilter === "blocked" ? "default" : "outline"}
              onClick={() => setFocusFilter("blocked")}
            >
              Blocked
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="admin-card-link overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Flagged transactions</CardTitle>
          <CardDescription>
            Each row gives the reviewer enough context to choose which transaction to open next.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load review queue."}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState
              title="No transactions in the manual review queue"
              description="When wallet or agent rules hold a transaction for a second check, it will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Why it was held</TableHead>
                  <TableHead>Agent & wallet</TableHead>
                  <TableHead>Audit state</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const reasons = getTransactionReviewReasons(transaction);

                  return (
                    <TableRow key={transaction.id} className="admin-table-row">
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <Link
                            href={`/admin/transactions/${transaction.id}`}
                            className="admin-link text-base"
                          >
                            {transaction.vendor ?? transaction.recipient ?? "Unknown vendor"}
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(transaction.amount, transaction.currency)} ·{" "}
                            {formatDateTime(transaction.requestedAt)}
                          </p>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {transaction.purpose ?? transaction.memo ?? "No agent justification recorded."}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">{transaction.id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-2">
                          {reasons.map((reason) => (
                            <Badge key={reason.id} variant={reason.tone}>
                              {reason.label}
                            </Badge>
                          ))}
                          {transaction.policyResult ? (
                            <PolicyResultBadge result={transaction.policyResult} />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-foreground">{transaction.agentName}</p>
                          <p className="text-muted-foreground">{transaction.walletName}</p>
                          <p className="text-xs text-muted-foreground">
                            {transaction.sourceKind?.replace(/_/g, " ") ?? "manual"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          <TransactionStatusBadge status={transaction.status} />
                          {transaction.reviewState ? (
                            <Badge variant="outline" className="capitalize">
                              Review: {transaction.reviewState.replace(/_/g, " ")}
                            </Badge>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            Last touched {formatDateTime(transaction.settledAt ?? transaction.requestedAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button asChild>
                          <Link href={`/admin/transactions/${transaction.id}`}>
                            Review now
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Reviewer guidance
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <p>Confirm the agent&apos;s stated purpose matches the business intent and the workflow that triggered spend.</p>
          <p>Verify policy exceptions like vendor approval, limits, or missing evidence before you approve.</p>
          <p>Use the audit trail to confirm who changed the transaction and whether any earlier review decisions need to be reversed.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminReviewQueuePage() {
  return (
    <Suspense fallback={<ReviewQueueFallback />}>
      <ReviewQueuePageContent />
    </Suspense>
  );
}
