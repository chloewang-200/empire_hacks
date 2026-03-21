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
  CompanyStatusBadge,
} from "@/components/admin/AdminStatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCompany } from "@/lib/services/admin/companies";
import { listAgentsByCompany } from "@/lib/services/admin/agents";
import { listTransactionsByAgent } from "@/lib/services/admin/transactions";

export default function AdminCompanyDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["admin-company", clientId],
    queryFn: () => getCompany(clientId),
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["admin-company-agents", clientId],
    queryFn: () => listAgentsByCompany(clientId),
  });

  const { data: agentTransactions } = useQuery({
    queryKey: ["admin-company-agent-transactions", clientId],
    queryFn: async () => {
      const companyAgents = await listAgentsByCompany(clientId);
      const transactions = await Promise.all(
        companyAgents.map((agent) => listTransactionsByAgent(agent.agentId))
      );
      return transactions.flat();
    },
  });

  if (companyLoading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const companyAgents = agents ?? [];
  const transactions = agentTransactions ?? [];

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-1 text-foreground">{company.companyName}</h1>
            <CompanyStatusBadge status={company.companyStatus} />
          </div>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Company-level admin view for connected agents and transaction oversight.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPIStatCard title="Agents" value={company.agentCount} icon={Bot} />
        <KPIStatCard title="Transactions" value={company.transactionCount} icon={Receipt} />
        <KPIStatCard
          title="Pending approvals"
          value={company.pendingApprovalCount}
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
                {companyAgents.map((agent) => (
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
          <CardTitle className="text-base">Recent company transactions</CardTitle>
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
