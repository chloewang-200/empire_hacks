"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getReviewQueue } from "@/lib/api/review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";

function ReviewQueueFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

function ReviewQueueContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
    queryKey: ["review-queue", { page: 1, pageSize: 50 }],
    retry: false,
    queryFn: () => getReviewQueue({ page: 1, pageSize: 50 }),
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Review Queue</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Human review console for flagged or pending transaction requests.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{total}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items needing review</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : error ? (
            <div className="py-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Could not load review items."}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Queue is empty"
              description="Transactions flagged for review will appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.transactionId}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatCurrency(item.transaction.amount, item.transaction.currency)} ·{" "}
                      {item.transaction.agentName}
                    </p>
                    <p className="text-body-sm text-muted-foreground">
                      {item.transaction.walletName}
                      {item.flaggedReason && ` · ${item.flaggedReason}`}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {formatDateTime(item.transaction.requestedAt)} · Waiting {item.ageMinutes}m
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TransactionStatusBadge status={item.transaction.status} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedId(item.transactionId)}
                    >
                      Review
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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

export default function ReviewQueuePage() {
  return (
    <Suspense fallback={<ReviewQueueFallback />}>
      <ReviewQueueContent />
    </Suspense>
  );
}
