"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Building2, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { KPIStatCard } from "@/components/cards/KPIStatCard";
import { AdminClientStatusBadge } from "@/components/admin/AdminStatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listAdminClients } from "@/lib/services/admin/clients";

export default function AdminClientsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: listAdminClients,
  });

  const clients = data ?? [];
  const totalAgents = clients.reduce((sum, client) => sum + client.agentCount, 0);
  const totalTransactions = clients.reduce(
    (sum, client) => sum + client.transactionCount,
    0
  );
  const pendingApprovals = clients.reduce(
    (sum, client) => sum + client.pendingApprovalCount,
    0
  );
  const paidVolume = clients.reduce((sum, client) => sum + client.paidVolume, 0);

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Clients</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Admin oversight across client organizations, connected agents, and transaction activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard title="Clients" value={clients.length} icon={Building2} />
        <KPIStatCard title="Agents" value={totalAgents} icon={Wallet} />
        <KPIStatCard title="Transactions" value={totalTransactions} icon={Receipt} />
        <KPIStatCard
          title="Pending Approval"
          value={pendingApprovals}
          subValue={` · ${formatCurrency(paidVolume)}`}
          icon={ShieldAlert}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All clients</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Primary contact</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Pending approvals</TableHead>
                  <TableHead>Last transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.clientId} className="admin-table-row">
                    <TableCell className="font-medium">
                      <Link href={`/admin/clients/${client.clientId}`} className="admin-link">
                        {client.clientName}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <p className="text-xs text-muted-foreground">{client.clientId}</p>
                    </TableCell>
                    <TableCell>
                      <AdminClientStatusBadge status={client.clientStatus} />
                    </TableCell>
                    <TableCell>
                      {client.primaryContactName ?? client.primaryContactEmail}
                      <p className="text-xs text-muted-foreground">
                        {client.primaryContactEmail}
                      </p>
                    </TableCell>
                    <TableCell>{client.agentCount}</TableCell>
                    <TableCell>{client.transactionCount}</TableCell>
                    <TableCell>{client.pendingApprovalCount}</TableCell>
                    <TableCell>
                      {client.lastTransactionAt
                        ? formatDate(client.lastTransactionAt)
                        : "No activity"}
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
