"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApprovalStatusBadge,
  ManualReviewStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/AdminStatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  approveTransaction,
  getTransaction,
  markTransactionDone,
  rejectTransaction,
  unapproveTransaction,
  verifyTransactionRules,
} from "@/lib/services/admin/transactions";

export default function AdminTransactionDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const transactionId = params.transactionId as string;

  const { data: transaction, isLoading } = useQuery({
    queryKey: ["admin-transaction", transactionId],
    queryFn: () => getTransaction(transactionId),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveTransaction(transactionId, "Approved from admin console"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction", transactionId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTransaction(transactionId, "Rejected from admin console"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction", transactionId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const unapproveMutation = useMutation({
    mutationFn: () =>
      unapproveTransaction(transactionId, "Approval reverted from transaction detail"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction", transactionId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyTransactionRules(transactionId, "Verified from transaction detail"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction", transactionId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: () =>
      markTransactionDone(transactionId, "Marked done from transaction detail"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-transaction", transactionId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-agent-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  if (isLoading || !transaction) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={transaction.agentId ? `/admin/agents/${transaction.agentId}` : "/admin/companies"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="font-mono text-caption text-muted-foreground">
            {transaction.transactionId}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-heading-1 text-foreground">
              {formatCurrency(transaction.amount, transaction.currency)}
            </h1>
            <PaymentStatusBadge status={transaction.paymentStatus} />
            <ApprovalStatusBadge status={transaction.approvalStatus} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => verifyMutation.mutate()}
          disabled={verifyMutation.isPending || transaction.manualReviewStatus === "verified"}
        >
          {verifyMutation.isPending ? "Verifying..." : "Verify rules"}
        </Button>
        <Button
          onClick={() => approveMutation.mutate()}
          disabled={
            approveMutation.isPending || transaction.approvalStatus === "human_approved"
          }
        >
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button
          variant="outline"
          onClick={() => unapproveMutation.mutate()}
          disabled={
            unapproveMutation.isPending || transaction.approvalStatus !== "human_approved"
          }
        >
          {unapproveMutation.isPending ? "Undoing..." : "Undo approval"}
        </Button>
        <Button
          onClick={() => markDoneMutation.mutate()}
          disabled={markDoneMutation.isPending || transaction.isMade}
        >
          {markDoneMutation.isPending ? "Marking done..." : "Mark done"}
        </Button>
        <Button
          variant="outline"
          onClick={() => rejectMutation.mutate()}
          disabled={rejectMutation.isPending || transaction.approvalStatus === "rejected"}
        >
          {rejectMutation.isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vendor</span>
              <span>{transaction.vendorNameSnapshot}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Transaction type</span>
              <span>{transaction.transactionType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment method</span>
              <span>{transaction.paymentMethod}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Human approved</span>
              <Badge variant={transaction.isHumanApproved ? "success" : "outline"}>
                {transaction.isHumanApproved ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rule review</span>
              <ManualReviewStatusBadge status={transaction.manualReviewStatus} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Made</span>
              <Badge variant={transaction.isMade ? "success" : "outline"}>
                {transaction.isMade ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Verified at</span>
              <span className="max-w-[60%] text-right">
                {transaction.manuallyVerifiedAt
                  ? formatDateTime(transaction.manuallyVerifiedAt)
                  : "Not yet verified"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Description</span>
              <span className="max-w-[60%] text-right">
                {transaction.description ?? "—"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Compliance flags</span>
              <span className="max-w-[60%] text-right">
                {transaction.complianceFlags.join(", ") || "None"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Requested at</span>
              <span className="max-w-[60%] text-right">
                {formatDateTime(transaction.createdAt)}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Updated at</span>
              <span className="max-w-[60%] text-right">
                {formatDateTime(transaction.updatedAt)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit trail</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 border-l-2 border-border pl-4 text-sm">
              {transaction.auditTrail.map((eventItem) => (
                <li key={eventItem.eventId}>
                  <p className="font-medium capitalize">
                    {eventItem.eventType.replace(/_/g, " ")}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(eventItem.eventTimestamp)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
