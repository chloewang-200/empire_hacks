"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getTransaction } from "@/lib/api/transactions";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { PolicyResultBadge } from "@/components/status/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TransactionDetailSheetProps {
  transactionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailSheet({
  transactionId,
  open,
  onOpenChange,
}: TransactionDetailSheetProps) {
  const { data: tx, isLoading } = useQuery({
    queryKey: ["transactions", transactionId],
    queryFn: () => getTransaction(transactionId),
    enabled: open && !!transactionId,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transaction details</SheetTitle>
        </SheetHeader>
        {isLoading || !tx ? (
          <Skeleton className="mt-6 h-48 w-full" />
        ) : (
          <div className="mt-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-caption text-muted-foreground">{tx.id}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatCurrency(tx.amount, tx.currency)}
                </p>
              </div>
              <TransactionStatusBadge status={tx.status} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-body-sm">
                <p><span className="text-muted-foreground">Agent:</span> {tx.agentName}</p>
                <p><span className="text-muted-foreground">Wallet:</span> {tx.walletName}</p>
                <p><span className="text-muted-foreground">Vendor:</span> {tx.vendor ?? tx.recipient ?? "—"}</p>
                <p><span className="text-muted-foreground">Category:</span> {tx.category ?? "—"}</p>
                <p><span className="text-muted-foreground">Requested:</span> {formatDateTime(tx.requestedAt)}</p>
                {tx.memo && <p><span className="text-muted-foreground">Memo:</span> {tx.memo}</p>}
              </CardContent>
            </Card>

            {tx.policyResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Policy decision</CardTitle>
                </CardHeader>
                <CardContent>
                  <PolicyResultBadge result={tx.policyResult} />
                  {tx.policyEvaluation && tx.policyEvaluation.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {tx.policyEvaluation.map((item) => (
                        <li
                          key={item.check}
                          className="flex items-center gap-2 text-body-sm"
                        >
                          <Badge
                            variant={item.result === "pass" ? "success" : "destructive"}
                            className="text-xs"
                          >
                            {item.result}
                          </Badge>
                          {item.check}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {tx.evidence && tx.evidence.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Supporting evidence</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-body-sm">
                    {tx.evidence.map((e) => (
                      <li key={e.id}>
                        <span className="text-muted-foreground">{e.type}</span>
                        {e.filename && ` — ${e.filename}`}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {tx.auditEvents && tx.auditEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Audit trail</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 border-l-2 border-border pl-4">
                    {tx.auditEvents.map((e) => (
                      <li key={e.id} className="text-body-sm">
                        <span className="text-muted-foreground">
                          {formatDateTime(e.timestamp)}
                        </span>{" "}
                        {e.action}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
