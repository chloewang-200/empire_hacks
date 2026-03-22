"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, FileText, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PolicyResultBadge } from "@/components/status/StatusBadge";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { formatDateTime } from "@/lib/utils";
import { reviewTransaction } from "@/lib/api/transactions";
import type { CitedRule, Transaction } from "@/lib/types";

const auditTypeLabel: Record<string, string> = {
  request: "Request",
  agent_context: "Agent context",
  payee_resolution: "Payee",
  evidence: "Evidence",
  policy: "Policy",
  human: "Human",
  agent_decision: "Agent decision",
  citations: "Citations",
  risk: "Risk",
  invoice_auditor: "Invoice auditor",
};

function ContextJson({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/60 p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function TransactionAuditPanel({ tx }: { tx: Transaction }) {
  const needsAttention = tx.status === "pending_review" || tx.status === "blocked";

  return (
    <div className="space-y-6">
      {needsAttention && (
        <div
          className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Needs attention</p>
            <p className="mt-1 text-muted-foreground dark:text-amber-200/90">
              {tx.status === "blocked"
                ? "Policy blocked this payment. See policy checks below for why."
                : "Raised for human review — policy, payee directory, or manual ops mode may require approval."}
            </p>
            {tx.status === "pending_review" && (
              <ButtonLinkReviewQueue className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" />
            )}
          </div>
        </div>
      )}

      <TransactionReviewActions tx={tx} />

      <div className="flex flex-wrap items-center gap-2">
        <TransactionStatusBadge status={tx.status} />
        {tx.policyResult && <PolicyResultBadge result={tx.policyResult} />}
        {tx.reviewState && tx.reviewState !== "approved" && (
          <Badge variant="outline" className="capitalize">
            Review: {tx.reviewState.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      {(tx.riskScore != null ||
        (tx.riskFlags && tx.riskFlags.length > 0) ||
        (tx.citedRules && tx.citedRules.length > 0) ||
        tx.agentDecision) && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Trust &amp; audit payload
            </CardTitle>
            <CardDescription>
              Agent-supplied signals for human review (risk, citations, decision trace).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-body-sm">
            {tx.riskScore != null && (
              <p>
                <span className="text-muted-foreground">Risk score:</span>{" "}
                <span className="font-semibold tabular-nums">{tx.riskScore}</span>
                <span className="text-caption text-muted-foreground"> / 100</span>
              </p>
            )}
            {tx.riskFlags && tx.riskFlags.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Risk flags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {tx.riskFlags.map((f) => (
                    <Badge key={f} variant="secondary">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {tx.agentDecision && (
              <div className="rounded-md border border-border bg-background/80 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agent decision</p>
                <p className="mt-1 font-medium">{tx.agentDecision.summary}</p>
                {tx.agentDecision.reasoning && (
                  <p className="mt-2 text-caption text-muted-foreground whitespace-pre-wrap">
                    {tx.agentDecision.reasoning}
                  </p>
                )}
                {tx.agentDecision.modelConfidence != null && (
                  <p className="mt-2 text-caption">
                    <span className="text-muted-foreground">Model confidence:</span>{" "}
                    {Math.round(tx.agentDecision.modelConfidence * 100)}%
                  </p>
                )}
              </div>
            )}
            {tx.citedRules && tx.citedRules.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cited rules</p>
                <ul className="mt-2 space-y-2">
                  {(tx.citedRules as CitedRule[]).map((r) => (
                    <li key={r.id} className="rounded-md border border-border p-2 text-body-sm">
                      <p className="font-medium">
                        <span className="font-mono text-xs text-muted-foreground">{r.id}</span> — {r.title}
                      </p>
                      {r.source && (
                        <p className="text-caption text-muted-foreground mt-1">Source: {r.source}</p>
                      )}
                      {r.excerpt && (
                        <p className="mt-1 text-caption italic border-l-2 border-primary/30 pl-2">{r.excerpt}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purpose &amp; audit summary</CardTitle>
          <CardDescription>Why this spend was requested and how it was matched.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-body-sm">
          <p>
            <span className="text-muted-foreground">Purpose:</span>{" "}
            {tx.purpose?.trim() ? tx.purpose : <span className="italic text-muted-foreground">Not provided</span>}
          </p>
          {tx.context && Object.keys(tx.context).length > 0 && (
            <div>
              <span className="text-muted-foreground">Agent context</span>
              <ContextJson value={tx.context} />
            </div>
          )}
          {tx.matchedPayee ? (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved payee</p>
              <p className="mt-1 font-medium">{tx.matchedPayee.displayName}</p>
              <p className="text-caption text-muted-foreground">Default rail: {tx.matchedPayee.defaultRail}</p>
              {tx.matchedPayee.paymentInstructions && (
                <p className="mt-2 text-body-sm">{tx.matchedPayee.paymentInstructions}</p>
              )}
              {tx.matchedPayee.stripeConnectAccountId && (
                <p className="mt-1 font-mono text-caption text-muted-foreground">
                  Stripe Connect: {tx.matchedPayee.stripeConnectAccountId}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No directory payee linked — vendor string may still be shown in summary.
            </p>
          )}
        </CardContent>
      </Card>

      {(tx.payoutStatus || tx.payoutError || tx.payoutExternalId || tx.payoutProvider) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Payout execution
            </CardTitle>
            <CardDescription>Automated transfer attempt after policy approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-body-sm">
            {tx.railType && (
              <p>
                <span className="text-muted-foreground">Rail:</span> {tx.railType}
              </p>
            )}
            {tx.payoutStatus && (
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className="capitalize">{tx.payoutStatus.replace(/_/g, " ")}</span>
              </p>
            )}
            {tx.payoutProvider && (
              <p>
                <span className="text-muted-foreground">Provider:</span> {tx.payoutProvider}
              </p>
            )}
            {tx.payoutExternalId && (
              <p className="font-mono text-xs">
                <span className="text-muted-foreground">External id:</span> {tx.payoutExternalId}
              </p>
            )}
            {tx.payoutAttemptedAt && (
              <p className="text-caption text-muted-foreground">
                Attempted: {formatDateTime(tx.payoutAttemptedAt)}
              </p>
            )}
            {tx.payoutError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-caption text-destructive">
                {tx.payoutError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {tx.policyResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Policy evaluation
            </CardTitle>
            <CardDescription>Each gate the request passed or failed.</CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyResultBadge result={tx.policyResult} className="mb-3" />
            {tx.policyEvaluation && tx.policyEvaluation.length > 0 && (
              <ul className="space-y-2">
                {tx.policyEvaluation.map((item) => (
                  <li key={item.check} className="flex flex-wrap items-center gap-2 text-body-sm">
                    <Badge variant={item.result === "pass" ? "success" : "destructive"} className="text-xs">
                      {item.result}
                    </Badge>
                    <span className="font-medium">{item.check}</span>
                    {item.detail && (
                      <span className="w-full text-caption text-muted-foreground sm:w-auto">{item.detail}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {tx.evidence && tx.evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Proof &amp; attachments
            </CardTitle>
            <CardDescription>Evidence supplied with the request (e.g. invoice file id).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-body-sm">
              {tx.evidence.map((e, i) => {
                const fileId = "fileId" in e && e.fileId != null ? String(e.fileId) : null;
                const fn = "filename" in e && e.filename != null ? String(e.filename) : null;
                return (
                  <li key={"id" in e && e.id ? String(e.id) : i} className="rounded-md border border-border p-3">
                    <span className="font-medium capitalize">{e.type}</span>
                    {fn ? <span className="text-muted-foreground"> — {fn}</span> : null}
                    {fileId ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">fileId: {fileId}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {tx.auditEvents && tx.auditEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
            <CardDescription>When, what, and who — immutable audit log for this request.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l-2 border-border pl-6">
              {tx.auditEvents.map((e) => (
                <li key={e.id} className="text-body-sm">
                  <span className="absolute -left-[calc(0.5rem+1px)] mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-caption text-muted-foreground">{formatDateTime(e.timestamp)}</p>
                  <p className="font-medium">
                    {e.type && (
                      <Badge variant="secondary" className="mr-2 text-[10px] font-normal">
                        {auditTypeLabel[e.type] ?? e.type}
                      </Badge>
                    )}
                    {e.action}
                  </p>
                  {e.actor && <p className="text-caption text-muted-foreground">Actor: {e.actor}</p>}
                  {e.detail && (
                    <p className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs">{e.detail}</p>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ButtonLinkReviewQueue({ className }: { className?: string }) {
  return (
    <Link href="/review-queue" className={className}>
      Open review queue
    </Link>
  );
}

function TransactionReviewActions({ tx }: { tx: Transaction }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const awaitingHuman =
    tx.status === "pending_review" && (tx.reviewState === "pending" || tx.reviewState == null);

  const mutation = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      reviewTransaction(tx.id, { decision, note: note.trim() || undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions", tx.id] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
  });

  if (!awaitingHuman) return null;

  return (
    <Card className="border-primary/35 bg-primary/[0.06] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Your decision</CardTitle>
        <CardDescription>
          Approve to mark this spend allowed (and run auto-payout if the wallet has it on). Decline to block it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={`review-note-${tx.id}`}>Note for audit log (optional)</Label>
          <Textarea
            id={`review-note-${tx.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1.5 resize-none text-sm"
            placeholder="e.g. Verified against invoice PDF"
            disabled={mutation.isPending}
          />
        </div>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Review failed"}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("approve")}
          >
            {mutation.isPending ? "Working…" : "Approve"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("reject")}
          >
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
