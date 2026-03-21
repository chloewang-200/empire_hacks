"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAgent } from "@/lib/api/agents";
import { AgentStatusBadge } from "@/components/status/StatusBadge";
import { ApiKeyRevealCard } from "@/components/agents/ApiKeyRevealCard";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: agent, isLoading } = useQuery({
    queryKey: ["agents", id],
    queryFn: () => getAgent(id),
  });

  if (isLoading || !agent) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-heading-1 text-foreground">{agent.name}</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {agent.templateType} · {agent.assignedWalletName ?? agent.assignedWalletId}
          </p>
        </div>
        <AgentStatusBadge status={agent.status} />
        <Button variant="outline" onClick={() => router.push(`/agents/${id}/edit`)}>
          Edit
        </Button>
      </div>

      {agent.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-body-sm text-muted-foreground">{agent.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{agent.assignedWalletName ?? agent.assignedWalletId}</p>
            <Button variant="link" className="h-auto p-0 mt-1" asChild>
              <Link href={`/wallets/${agent.assignedWalletId}`}>View wallet</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role & capabilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-body-sm capitalize">{agent.role}</p>
            {agent.capabilities?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-caption text-muted-foreground">No capabilities assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      <ApiKeyRevealCard agentId={agent.id} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
          <p className="text-caption text-muted-foreground">Last active {agent.lastActiveAt ? formatDate(agent.lastActiveAt) : "—"}</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div>
              <p className="text-caption text-muted-foreground">Transaction volume</p>
              <p className="text-body font-medium">
                {agent.transactionVolume != null ? formatCurrency(agent.transactionVolume) : "—"}
              </p>
            </div>
            <div>
              <p className="text-caption text-muted-foreground">Transaction count</p>
              <p className="text-body font-medium">{agent.transactionCount ?? "—"}</p>
            </div>
          </div>
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/transactions?agentId=${agent.id}`}>View transactions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
