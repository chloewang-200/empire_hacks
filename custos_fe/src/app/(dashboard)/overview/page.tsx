"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Receipt, ClipboardList, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgents } from "@/lib/api/agents";
import { getWallets } from "@/lib/api/wallets";
import { getTransactions } from "@/lib/api/transactions";
import { getReviewQueue } from "@/lib/api/review";
import { formatCurrency } from "@/lib/utils";
import { KPIStatCard } from "@/components/cards/KPIStatCard";
import { EmptyState } from "@/components/empty-state/EmptyState";
import { TotalAgentsCard } from "@/components/overview/TotalAgentsCard";
import { AgentsOverviewSection } from "@/components/overview/AgentsOverviewSection";
import { TotalWalletsCard } from "@/components/overview/TotalWalletsCard";
import { WalletsOverviewSection } from "@/components/overview/WalletsOverviewSection";

export default function OverviewPage() {
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["agents", { page: 1, pageSize: 100 }],
    queryFn: () => getAgents({ page: 1, pageSize: 100 }),
  });
  const { data: walletsData, isLoading: walletsLoading } = useQuery({
    queryKey: ["wallets", { page: 1, pageSize: 100 }],
    queryFn: () => getWallets({ page: 1, pageSize: 100 }),
  });
  const { data: txData } = useQuery({
    queryKey: ["transactions", { page: 1, pageSize: 10 }],
    queryFn: () => getTransactions({ page: 1, pageSize: 10 }),
  });
  const { data: reviewData } = useQuery({
    queryKey: ["review-queue"],
    queryFn: () => getReviewQueue({ page: 1, pageSize: 10 }),
  });

  const agents = agentsData?.data ?? [];
  const wallets = walletsData?.data ?? [];
  const totalAgents = agentsData?.total ?? 0;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const totalWallets = walletsData?.total ?? 0;
  const activeWallets = wallets.filter((w) => w.status === "active").length;
  const totalVolume = txData?.data?.reduce((s, t) => s + t.amount, 0) ?? 0;
  const approvedCount = txData?.data?.filter((t) => t.status === "approved" || t.status === "settled").length ?? 0;
  const txCount = txData?.data?.length ?? 0;
  const approvalRate = txCount > 0 ? Math.round((approvedCount / txCount) * 100) : 0;
  const pendingReview = reviewData?.total ?? 0;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Overview</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Operational visibility across wallets, agents, and transactions.
        </p>
      </div>

      {/* Top: Wallets (left) | Agents (right) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TotalWalletsCard total={totalWallets} activeCount={activeWallets} />
          <WalletsOverviewSection wallets={wallets} isLoading={walletsLoading} />
        </div>
        <div className="space-y-6">
          <TotalAgentsCard total={totalAgents} activeCount={activeAgents} />
          <AgentsOverviewSection agents={agents} isLoading={agentsLoading} />
        </div>
      </div>

      {/* Below: approval rate, volume, recent transactions, quick actions */}
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <KPIStatCard title="Approval Rate" value={`${approvalRate}%`} icon={Receipt} />
          <KPIStatCard title="Transaction Volume" value={formatCurrency(totalVolume)} icon={Receipt} />
          <KPIStatCard title="Pending Review" value={pendingReview} icon={ClipboardList} />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/transactions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!txData ? (
              <Skeleton className="h-32 w-full" />
            ) : txData.data.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                description="Agent-submitted transactions will appear here."
                action={
                  <Button asChild>
                    <Link href="/templates/invoice">Try Invoice Agent</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {txData.data.slice(0, 5).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 hover:bg-muted/50"
                  >
                    <span className="text-body-sm truncate">
                      {t.agentName} · {formatCurrency(t.amount, t.currency)}
                    </span>
                    <span className="text-caption text-muted-foreground">{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/wallets?create=1">
                <Plus className="mr-2 h-4 w-4" />
                Add wallet
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/agents?create=1">
                <Plus className="mr-2 h-4 w-4" />
                Add agent
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/review-queue">
                <ClipboardList className="mr-2 h-4 w-4" />
                Review queue
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/templates/invoice">
                <ArrowRight className="mr-2 h-4 w-4" />
                Invoice Agent
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/templates/event-production">
                <ArrowRight className="mr-2 h-4 w-4" />
                Event payouts
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
