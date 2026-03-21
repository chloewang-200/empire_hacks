"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { KPIStatCard } from "@/components/cards/KPIStatCard";
import { CompanyStatusBadge } from "@/components/admin/AdminStatusBadge";
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
import { listCompanies } from "@/lib/services/admin/companies";

export default function AdminCompaniesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: listCompanies,
  });

  const companies = data ?? [];
  const totalAgents = companies.reduce((sum, company) => sum + company.agentCount, 0);
  const totalTransactions = companies.reduce(
    (sum, company) => sum + company.transactionCount,
    0
  );
  const pendingApprovals = companies.reduce(
    (sum, company) => sum + company.pendingApprovalCount,
    0
  );
  const paidVolume = companies.reduce((sum, company) => sum + company.paidVolume, 0);

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Companies</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Admin oversight across all customer accounts, agents, and transaction activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPIStatCard title="Companies" value={companies.length} icon={Building2} />
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
          <CardTitle className="text-base">All companies</CardTitle>
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
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Pending approvals</TableHead>
                  <TableHead>Paid volume</TableHead>
                  <TableHead>Last transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.clientId} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/admin/companies/${company.clientId}`}>
                        {company.companyName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <CompanyStatusBadge status={company.companyStatus} />
                    </TableCell>
                    <TableCell>{company.agentCount}</TableCell>
                    <TableCell>{company.transactionCount}</TableCell>
                    <TableCell>{company.pendingApprovalCount}</TableCell>
                    <TableCell>
                      {formatCurrency(company.paidVolume, company.defaultCurrency)}
                    </TableCell>
                    <TableCell>
                      {company.lastTransactionAt
                        ? formatDate(company.lastTransactionAt)
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
