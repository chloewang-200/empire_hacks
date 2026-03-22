"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { getTransactionReviewReasons } from "@/lib/adminTransactionReview";
import { EvidenceFilePreview } from "@/components/transactions/EvidenceFilePreview";
import { PolicyResultBadge } from "@/components/status/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

function JsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function MiniStat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-background p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function SnapshotSignal({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneClasses =
    tone === "danger"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-slate-50";

  return (
    <div className={cn("rounded-xl border p-4", toneClasses)}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm font-medium leading-6 text-foreground">{value}</div>
    </div>
  );
}

function DetailList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-1 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
        >
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <div className="text-sm text-foreground sm:max-w-[62%] sm:text-right">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatAuditPayload(details: Record<string, unknown>) {
  const rawDetail = details.detail;

  if (typeof rawDetail === "string") {
    try {
      return {
        summary: "Structured event payload",
        payload: JSON.parse(rawDetail) as Record<string, unknown>,
      };
    } catch {
      return {
        summary: rawDetail,
        payload: null,
      };
    }
  }

  if (rawDetail && typeof rawDetail === "object") {
    return {
      summary: "Structured event payload",
      payload: rawDetail as Record<string, unknown>,
    };
  }

  if (Object.keys(details).length > 0) {
    return {
      summary: "Structured event payload",
      payload: details,
    };
  }

  return {
    summary: null,
    payload: null,
  };
}

function AuditEventDetails({ details }: { details: Record<string, unknown> }) {
  const formatted = formatAuditPayload(details);

  if (!formatted.summary && !formatted.payload) return null;

  if (!formatted.payload) {
    return <p className="mt-3 text-sm text-foreground">{formatted.summary}</p>;
  }

  return (
    <details className="mt-3 rounded-lg border border-border bg-muted/30 open:bg-muted/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground">
        <span>{formatted.summary}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </summary>
      <div className="border-t border-border px-4 py-4">
        <JsonBlock value={formatted.payload} />
      </div>
    </details>
  );
}

export default function AdminTransactionDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const transactionId = params.transactionId as string;
  const [reviewNote, setReviewNote] = useState("");

  const invalidateAdminQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-transaction", transactionId] }),
      queryClient.invalidateQueries({ queryKey: ["admin-agent-transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] }),
    ]);
  };

  const { data: transaction, isLoading } = useQuery({
    queryKey: ["admin-transaction", transactionId],
    queryFn: () => getTransaction(transactionId),
  });

  const noteOr = (fallback: string) => reviewNote.trim() || fallback;

  const approveMutation = useMutation({
    mutationFn: () => approveTransaction(transactionId, noteOr("Approved from admin console")),
    onSuccess: invalidateAdminQueries,
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTransaction(transactionId, noteOr("Rejected from admin console")),
    onSuccess: invalidateAdminQueries,
  });

  const unapproveMutation = useMutation({
    mutationFn: () =>
      unapproveTransaction(transactionId, noteOr("Approval reverted from transaction detail")),
    onSuccess: invalidateAdminQueries,
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyTransactionRules(transactionId, noteOr("Verified from transaction detail")),
    onSuccess: invalidateAdminQueries,
  });

  const markDoneMutation = useMutation({
    mutationFn: () => markTransactionDone(transactionId, noteOr("Marked done from transaction detail")),
    onSuccess: invalidateAdminQueries,
  });

  if (isLoading || !transaction) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const reviewReasons = getTransactionReviewReasons(transaction);
  const matchedPayee = transaction.matchedPayee;
  const citedRules = transaction.citedRules;
  const auditEvents = transaction.auditTrail;
  const policyChecks = transaction.policyEvaluation;
  const evidence = transaction.evidence;
  const snapshotPurpose =
    transaction.purpose ?? transaction.description ?? transaction.memo ?? "No purpose recorded";
  const stateTone =
    transaction.status === "blocked"
      ? "danger"
      : transaction.status === "pending_review"
        ? "warning"
        : transaction.status === "settled" || transaction.status === "approved"
          ? "success"
          : "neutral";
  const policyTone =
    transaction.policyResult?.includes("required") ||
    transaction.policyResult?.includes("manual") ||
    transaction.policyResult?.includes("missing") ||
    transaction.policyResult?.includes("matched") === false
      ? "warning"
      : transaction.policyResult?.includes("blocked") ||
          transaction.policyResult?.includes("denied") ||
          transaction.policyResult?.includes("restricted")
        ? "danger"
        : "neutral";
  const evidenceTone = evidence.length > 0 ? "success" : "warning";

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-up">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/review-queue">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-caption text-muted-foreground">
            {transaction.transactionId}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-heading-1 text-foreground">
              {transaction.vendorNameSnapshot}
            </h1>
            <Badge variant="outline">
              {formatCurrency(transaction.amount, transaction.currency)}
            </Badge>
            <PaymentStatusBadge status={transaction.paymentStatus} />
            <ApprovalStatusBadge status={transaction.approvalStatus} />
            <ManualReviewStatusBadge status={transaction.manualReviewStatus} />
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A focused reviewer view for the transaction, with the audit trail and decision inputs
            split into smaller sections.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-primary/[0.05]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Review snapshot</CardTitle>
            <CardDescription>
              Start here for the key facts before opening deeper detail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {reviewReasons.length > 0 ? (
                reviewReasons.map((reason) => (
                  <Badge key={reason.id} variant={reason.tone}>
                    {reason.label}
                  </Badge>
                ))
              ) : (
                <Badge variant="success">No active review flags</Badge>
              )}
              {transaction.policyResult ? (
                <PolicyResultBadge result={transaction.policyResult} />
              ) : null}
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="border-border/80 bg-background xl:col-span-3">
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Purpose
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground">
                    {snapshotPurpose}
                  </p>
                </CardContent>
              </Card>
              <SnapshotSignal
                label="Decision state"
                tone={stateTone}
                value={
                  <div className="space-y-2">
                    <p className="capitalize">{transaction.status.replace(/_/g, " ")}</p>
                    <div className="flex flex-wrap gap-2">
                      <PaymentStatusBadge status={transaction.paymentStatus} />
                      <ApprovalStatusBadge status={transaction.approvalStatus} />
                    </div>
                  </div>
                }
              />
              <SnapshotSignal
                label="Policy posture"
                tone={policyTone}
                value={
                  <div className="space-y-2">
                    <p>
                      {transaction.policyResult
                        ? transaction.policyResult.replace(/_/g, " ")
                        : "No policy hold"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ManualReviewStatusBadge status={transaction.manualReviewStatus} />
                      {transaction.riskScore != null ? (
                        <Badge variant="outline">Risk {transaction.riskScore}/100</Badge>
                      ) : null}
                    </div>
                  </div>
                }
              />
              <SnapshotSignal
                label="Execution readiness"
                tone={evidenceTone}
                value={
                  <div className="space-y-1">
                    <p>
                      {evidence.length
                        ? `${evidence.length} attachment${evidence.length === 1 ? "" : "s"}`
                        : "No supporting evidence"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {matchedPayee
                        ? `Matched payee: ${String(matchedPayee.displayName ?? "Approved payee")}`
                        : "No approved payee match"}
                    </p>
                  </div>
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="Agent"
                value={
                  transaction.agentId ? (
                    <Link href={`/admin/agents/${transaction.agentId}`} className="admin-link-subtle">
                      {transaction.agentName}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    transaction.agentName
                  )
                }
              />
              <MiniStat label="Wallet" value={transaction.walletName} />
              <MiniStat
                label="Requested"
                value={formatDateTime(transaction.createdAt)}
              />
              <MiniStat
                label="Category / rail"
                value={
                  transaction.category
                    ? `${transaction.category} · ${transaction.railType ?? "—"}`
                    : transaction.railType ?? "—"
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="admin-card-link lg:sticky lg:top-6 lg:self-start">
          <CardHeader>
            <CardTitle className="text-base">Reviewer action</CardTitle>
            <CardDescription>
              Add a short rationale before taking action.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Example: confirmed vendor, reviewed evidence, and accepted the policy exception."
              className="min-h-[120px]"
            />
            <div className="grid gap-2">
              <Button
                variant="outline"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || transaction.manualReviewStatus === "verified"}
              >
                {verifyMutation.isPending ? "Verifying..." : "Verify rules"}
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || transaction.approvalStatus === "human_approved"}
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
                variant="outline"
                onClick={() => markDoneMutation.mutate()}
                disabled={markDoneMutation.isPending || transaction.isMade}
              >
                {markDoneMutation.isPending ? "Marking done..." : "Mark done"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending || transaction.approvalStatus === "rejected"}
              >
                {rejectMutation.isPending ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4" />
                  Intent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    {
                      label: "Purpose",
                      value: transaction.purpose ?? "No purpose recorded",
                    },
                    {
                      label: "Description",
                      value: transaction.description ?? transaction.memo ?? "—",
                    },
                    { label: "Vendor", value: transaction.vendorNameSnapshot },
                    { label: "Recipient", value: transaction.recipient ?? "—" },
                    { label: "Category", value: transaction.category ?? "—" },
                    { label: "Source", value: transaction.sourceKind ?? "—" },
                    { label: "Rail", value: transaction.railType ?? "—" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4" />
                  Lifecycle
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    {
                      label: "Client",
                      value: (
                        <Link href={`/admin/clients/${transaction.clientId}`} className="admin-link-subtle">
                          Open client
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      ),
                    },
                    {
                      label: "Human approved",
                      value: (
                        <Badge variant={transaction.isHumanApproved ? "success" : "outline"}>
                          {transaction.isHumanApproved ? "Yes" : "No"}
                        </Badge>
                      ),
                    },
                    {
                      label: "Executed",
                      value: (
                        <Badge variant={transaction.isMade ? "success" : "outline"}>
                          {transaction.isMade ? "Yes" : "No"}
                        </Badge>
                      ),
                    },
                    {
                      label: "Verified at",
                      value: transaction.manuallyVerifiedAt
                        ? formatDateTime(transaction.manuallyVerifiedAt)
                        : "Not yet verified",
                    },
                    {
                      label: "Human approved at",
                      value: transaction.humanApprovedAt
                        ? formatDateTime(transaction.humanApprovedAt)
                        : "—",
                    },
                    {
                      label: "Settled at",
                      value: transaction.settledAt
                        ? formatDateTime(transaction.settledAt)
                        : "—",
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {matchedPayee ? (
            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="text-base">Matched payee</CardTitle>
                <CardDescription>
                  Vendor directory context for the request.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MiniStat
                  label="Payee"
                  value={String(matchedPayee.displayName ?? "Approved payee")}
                />
                <MiniStat
                  label="Default rail"
                  value={String(matchedPayee.defaultRail ?? "—")}
                />
                <MiniStat
                  label="Instructions"
                  value={String(matchedPayee.paymentInstructions ?? "—")}
                />
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="controls" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" />
                  Risk & policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {transaction.riskFlags.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Risk flags
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {transaction.riskFlags.map((flag) => (
                        <Badge key={flag} variant="secondary">
                          {flag.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {transaction.agentDecision ? (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Agent decision trace
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      {String(transaction.agentDecision.summary ?? "No summary")}
                    </p>
                    {transaction.agentDecision.reasoning ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {String(transaction.agentDecision.reasoning)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {policyChecks.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Policy checks
                    </p>
                    {policyChecks.map((check, index) => {
                      const result = String(check.result ?? "pass");

                      return (
                        <div
                          key={`${String(check.check ?? "check")}-${index}`}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={result === "pass" ? "success" : "destructive"}>
                              {result}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              {String(check.check ?? "Policy check")}
                            </span>
                          </div>
                          {check.detail ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {String(check.detail)}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="text-base">Operational state</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    {
                      label: "Approval status",
                      value: <ApprovalStatusBadge status={transaction.approvalStatus} />,
                    },
                    {
                      label: "Payment status",
                      value: <PaymentStatusBadge status={transaction.paymentStatus} />,
                    },
                    {
                      label: "Rule review",
                      value: <ManualReviewStatusBadge status={transaction.manualReviewStatus} />,
                    },
                    { label: "Payout status", value: transaction.payoutStatus ?? "—" },
                    { label: "Payout provider", value: transaction.payoutProvider ?? "—" },
                    {
                      label: "External payment ID",
                      value: transaction.externalPaymentId ?? "—",
                    },
                    {
                      label: "Failure reason",
                      value: transaction.failureReason ? (
                        <span className="text-destructive">{transaction.failureReason}</span>
                      ) : (
                        "—"
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          {citedRules.length > 0 ? (
            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="text-base">Cited rules</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {citedRules.map((rule, index) => (
                  <div key={index} className="rounded-lg border border-border p-4 text-sm">
                    <p className="font-medium text-foreground">
                      {String(rule.title ?? rule.id ?? "Rule")}
                    </p>
                    {rule.source ? (
                      <p className="mt-1 text-muted-foreground">Source: {String(rule.source)}</p>
                    ) : null}
                    {rule.excerpt ? (
                      <p className="mt-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
                        {String(rule.excerpt)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {transaction.context ? (
            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="text-base">Agent context payload</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonBlock value={transaction.context} />
              </CardContent>
            </Card>
          ) : null}

          {evidence.length > 0 ? (
            <Card className="admin-card-link">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {evidence.map((item, index) => {
                  const fileId =
                    "fileId" in item && item.fileId != null ? String(item.fileId) : null;
                  const filename =
                    "filename" in item && item.filename != null ? String(item.filename) : null;

                  return (
                    <div key={index} className="rounded-lg border border-border p-4">
                      <p className="font-medium text-foreground">
                        {String(item.type ?? "attachment")}
                        {filename ? ` - ${filename}` : ""}
                      </p>
                      {"confidence" in item && item.confidence != null ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Confidence: {String(item.confidence)}
                        </p>
                      ) : null}
                      {"extractedFields" in item &&
                      item.extractedFields &&
                      typeof item.extractedFields === "object" ? (
                        <div className="mt-3">
                          <JsonBlock value={item.extractedFields as Record<string, unknown>} />
                        </div>
                      ) : null}
                      {fileId ? (
                        <div className="mt-3">
                          <EvidenceFilePreview fileId={fileId} filename={filename ?? undefined} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card className="admin-card-link">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4" />
                Audit trail
              </CardTitle>
              <CardDescription>
                Sequence of request, review, and payout events.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 border-l-2 border-border pl-4">
                {auditEvents.map((eventItem) => (
                  <li key={eventItem.eventId} className="relative">
                    <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium capitalize text-foreground">
                          {eventItem.eventType.replace(/_/g, " ")}
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {eventItem.actorType}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTime(eventItem.eventTimestamp)}
                      </p>
                      {eventItem.actorId ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Actor: {eventItem.actorId}
                        </p>
                      ) : null}
                      <AuditEventDetails details={eventItem.details} />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldX className="h-4 w-4" />
                Reviewer checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Confirm the agent intent is specific enough to justify the spend.</p>
              <p>Verify any policy exception is acceptable for this wallet and business unit.</p>
              <p>Use the audit trail and payee details to confirm accountability.</p>
              <p>Leave a short reviewer note before approving, rejecting, or resetting review.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
