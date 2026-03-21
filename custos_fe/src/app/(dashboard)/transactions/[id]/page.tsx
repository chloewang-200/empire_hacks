"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTransaction } from "@/lib/api/transactions";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { PolicyResultBadge } from "@/components/status/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function TransactionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: tx, isLoading } = useQuery({
    queryKey: ["transactions", id],
    queryFn: () => getTransaction(id),
  });

  if (isLoading || !tx) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/transactions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="font-mono text-caption text-muted-foreground">{tx.id}</p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-heading-1 text-foreground">
              {formatCurrency(tx.amount, tx.currency)}
            </h1>
            <TransactionStatusBadge status={tx.status} />
          </div>
        </div>
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
                  <li key={item.check} className="flex items-center gap-2 text-body-sm">
                    <Badge variant={item.result === "pass" ? "success" : "destructive"} className="text-xs">
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
                  <span className="text-muted-foreground">{formatDateTime(e.timestamp)}</span> {e.action}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
