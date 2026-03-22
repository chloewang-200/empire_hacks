"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  AdminAgentStatusBadge,
  ApprovalStatusBadge,
  ManualReviewStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/AdminStatusBadge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { getAgent } from "@/lib/services/admin/agents";
import {
  listPendingTransactionsByAgent,
  markTransactionDone,
  unapproveTransaction,
  verifyTransactionRules,
} from "@/lib/services/admin/transactions";

export default function AdminAgentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const agentId = params.agentId as string;

  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["admin-agent", agentId],
    queryFn: () => getAgent(agentId),
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["admin-agent-transactions", agentId],
    queryFn: () => listPendingTransactionsByAgent(agentId),
  });

  const verifyMutation = useMutation({
    mutationFn: (transactionId: string) =>
      verifyTransactionRules(transactionId, "Verified against agent rules"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-agent-transactions", agentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: (transactionId: string) =>
      markTransactionDone(transactionId, "Completed manually from agent queue"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-agent-transactions", agentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
  });

  const unapproveMutation = useMutation({
    mutationFn: (transactionId: string) =>
      unapproveTransaction(transactionId, "Approval reverted from agent queue"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin-agent-transactions", agentId],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
  });

  if (agentLoading || !agent) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const rules = [
    {
      label: "Monthly allowance",
      value: formatCurrency(agent.monthlyAllowance, agent.currency),
    },
    {
      label: "Approval threshold",
      value: formatCurrency(agent.approvalThreshold, agent.currency),
    },
    {
      label: "Max transaction amount",
      value: formatCurrency(agent.maxTransactionAmount, agent.currency),
    },
    {
      label: "Allowed payment methods",
      value: agent.allowedPaymentMethods.join(", ") || "None",
    },
    {
      label: "Vendor allowlist",
      value: agent.vendorAllowlist.join(", ") || "None",
    },
    {
      label: "Vendor denylist",
      value: agent.vendorDenylist.join(", ") || "None",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/clients/${agent.clientId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-1 text-foreground">{agent.agentName}</h1>
            <AdminAgentStatusBadge status={agent.agentStatus} />
          </div>
          <p className="mt-1 text-body-sm text-muted-foreground">
            {agent.description ?? "Admin view into this agent's controls and transaction history."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rules and controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-muted-foreground">Agent type</span>
              <span>{agent.agentType ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-muted-foreground">API key prefix</span>
              <span>{agent.apiKeyPrefix ?? "—"}</span>
            </div>
            {rules.map((rule) => (
              <div
                key={rule.label}
                className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3"
              >
                <span className="text-muted-foreground">{rule.label}</span>
                <span className="max-w-[60%] text-right">{rule.value}</span>
              </div>
            ))}
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-muted-foreground">Last active</p>
              <p className="mt-1">{agent.lastActiveAt ? formatDateTime(agent.lastActiveAt) : "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              (transactions ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  No pending transactions for this agent right now.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Rule check</TableHead>
                      <TableHead>Human approved</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(transactions ?? []).map((transaction) => (
                      <TableRow key={transaction.transactionId} className="admin-table-row">
                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/transactions/${transaction.transactionId}`}
                            className="admin-link"
                          >
                            {transaction.vendorNameSnapshot}
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge status={transaction.paymentStatus} />
                        </TableCell>
                        <TableCell>
                          <ApprovalStatusBadge status={transaction.approvalStatus} />
                        </TableCell>
                        <TableCell>
                          <ManualReviewStatusBadge status={transaction.manualReviewStatus} />
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.isHumanApproved ? "success" : "outline"}>
                            {transaction.isHumanApproved ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(transaction.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/admin/transactions/${transaction.transactionId}`}>
                                Review
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => verifyMutation.mutate(transaction.transactionId)}
                              disabled={
                                verifyMutation.isPending ||
                                transaction.manualReviewStatus === "verified"
                              }
                            >
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unapproveMutation.mutate(transaction.transactionId)}
                              disabled={
                                unapproveMutation.isPending ||
                                transaction.approvalStatus !== "human_approved"
                              }
                            >
                              Undo approval
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => markDoneMutation.mutate(transaction.transactionId)}
                              disabled={markDoneMutation.isPending || transaction.isMade}
                            >
                              Mark done
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
