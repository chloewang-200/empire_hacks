"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, Receipt, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KPIStatCard } from "@/components/cards/KPIStatCard";
import {
  AdminAgentStatusBadge,
  AdminClientStatusBadge,
} from "@/components/admin/AdminStatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getAdminClient } from "@/lib/services/admin/clients";
import { listAgentsByCompany } from "@/lib/services/admin/agents";
import { listTransactionsByAgent } from "@/lib/services/admin/transactions";

export default function AdminClientDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["admin-client", clientId],
    queryFn: () => getAdminClient(clientId),
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["admin-client-agents", clientId],
    queryFn: () => listAgentsByCompany(clientId),
  });

  const { data: agentTransactions } = useQuery({
    queryKey: ["admin-client-agent-transactions", clientId],
    queryFn: async () => {
      const clientAgents = await listAgentsByCompany(clientId);
      const transactions = await Promise.all(
        clientAgents.map((agent) => listTransactionsByAgent(agent.agentId))
      );
      return transactions.flat();
    },
  });

  if (clientLoading || !client) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const clientAgents = agents ?? [];
  const transactions = agentTransactions ?? [];

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-1 text-foreground">{client.clientName}</h1>
            <AdminClientStatusBadge status={client.clientStatus} />
          </div>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {client.primaryContactName ?? client.primaryContactEmail} ·{" "}
            {client.primaryContactEmail} ·{" "}
            <span className="capitalize">{client.primaryContactRole}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Agents" value={client.agentCount} icon={Bot} />
        <KPIStatCard title="Transactions" value={client.transactionCount} icon={Receipt} />
        <KPIStatCard
          title="Pending approvals"
          value={client.pendingApprovalCount}
          icon={ShieldAlert}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {agentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Monthly allowance</TableHead>
                  <TableHead>Approval threshold</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientAgents.map((agent) => (
                  <TableRow key={agent.agentId}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/agents/${agent.agentId}`}>
                        {agent.agentName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <AdminAgentStatusBadge status={agent.agentStatus} />
                    </TableCell>
                    <TableCell>{agent.agentType ?? "—"}</TableCell>
                    <TableCell>{formatCurrency(agent.monthlyAllowance, agent.currency)}</TableCell>
                    <TableCell>{formatCurrency(agent.approvalThreshold, agent.currency)}</TableCell>
                    <TableCell>
                      {agent.lastActiveAt ? formatDate(agent.lastActiveAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent client transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {transactions.slice(0, 5).map((transaction) => (
            <div
              key={transaction.transactionId}
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
            >
              <div>
                <Link
                  href={`/admin/transactions/${transaction.transactionId}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {transaction.vendorNameSnapshot}
                </Link>
                <p className="text-muted-foreground">
                  {transaction.description ?? "Transaction request"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {formatCurrency(transaction.amount, transaction.currency)}
                </p>
                <p className="text-muted-foreground">
                  {formatDate(transaction.updatedAt)}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
