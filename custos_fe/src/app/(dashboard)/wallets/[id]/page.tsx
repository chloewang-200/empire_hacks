"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspace } from "@/lib/api/workspace";
import { getWallet } from "@/lib/api/wallets";
import { FundingPreferenceHint } from "@/components/wallets/FundingPreferenceHint";
import { refreshWalletBalances } from "@/lib/refreshWalletBalances";
import { WalletStatusBadge } from "@/components/status/StatusBadge";
import { AddFundsModal } from "@/components/wallets/AddFundsModal";
import { formatCurrency } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export default function WalletDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [fundOpen, setFundOpen] = useState(false);
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallets", id],
    queryFn: () => getWallet(id),
  });

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
  });

  useEffect(() => {
    const fund = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("fund");
    if (fund === "1") setFundOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("funded") !== "1") return;
    void refreshWalletBalances(queryClient, id);
  }, [searchParams, id, queryClient]);

  if (isLoading || !wallet) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const dailyLimit = wallet.policy?.limits?.daily;
  const dailyUsed = 0; // TODO: from API
  const dailyPct = dailyLimit && dailyLimit > 0 ? Math.min(100, (dailyUsed / dailyLimit) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/wallets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-heading-1 text-foreground">{wallet.name}</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {wallet.currency} · {wallet.assignedAgentsCount} agents
          </p>
        </div>
        <WalletStatusBadge status={wallet.status} />
        <Button variant="outline" onClick={() => setFundOpen(true)}>
          Add funds
        </Button>
      </div>

      {workspace && (
        <FundingPreferenceHint preference={workspace.fundingPreference ?? "BOTH"} />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Balance</CardTitle>
            <CardDescription>From deposits (Add funds) minus settled spend.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(wallet.balance, wallet.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily limit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-body tabular-nums">
              {dailyLimit != null
                ? formatCurrency(dailyLimit, wallet.currency)
                : "Not set"}
            </p>
            {dailyLimit != null && (
              <Progress value={dailyPct} className="mt-2" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-transaction limit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-body tabular-nums">
              {wallet.policy?.limits?.perTransaction != null
                ? formatCurrency(wallet.policy.limits.perTransaction, wallet.currency)
                : "Not set"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-body-sm">
            <span className="text-muted-foreground">Approval mode:</span>{" "}
            <span className="capitalize">{wallet.policy?.approvalMode ?? "—"}</span>
          </p>
          {wallet.policy?.allowedCategories?.length ? (
            <p className="text-body-sm">
              <span className="text-muted-foreground">Allowed categories:</span>{" "}
              {wallet.policy.allowedCategories.join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href={`/wallets/${id}/edit`}>Edit wallet</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/agents?walletId=${id}`}>View assigned agents</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/transactions?walletId=${id}`}>View transactions</Link>
        </Button>
      </div>

      <AddFundsModal
        walletId={wallet.id}
        walletName={wallet.name}
        currency={wallet.currency}
        open={fundOpen}
        onOpenChange={setFundOpen}
      />
    </div>
  );
}
