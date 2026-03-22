"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadInvoice, extractInvoice } from "@/lib/api/invoice";
import { requestTransaction } from "@/lib/api/transactions";
import { getPayees } from "@/lib/api/payees";
import type { InvoiceExtractionResult } from "@/lib/types";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getWallets } from "@/lib/api/wallets";
import { getAgents } from "@/lib/api/agents";
import { buildInvoiceTrustFields } from "@/lib/invoiceSubmissionTrust";

export default function InvoiceAgentPage() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<InvoiceExtractionResult | null>(null);
  const [txResult, setTxResult] = useState<Awaited<ReturnType<typeof requestTransaction>> | null>(null);
  const [walletId, setWalletId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [payeeOverrideId, setPayeeOverrideId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitResultRef = useRef<HTMLDivElement>(null);

  const { data: walletsData } = useQuery({
    queryKey: ["wallets", { page: 1, pageSize: 100 }],
    queryFn: () => getWallets({ page: 1, pageSize: 100 }),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["agents", { page: 1, pageSize: 100 }],
    queryFn: () => getAgents({ page: 1, pageSize: 100 }),
  });
  const { data: payees = [] } = useQuery({
    queryKey: ["payees"],
    queryFn: getPayees,
  });
  const wallets = walletsData?.data ?? [];
  const agents = agentsData?.data ?? [];

  const invoiceAgents = useMemo(
    () => agents.filter((a) => a.templateType === "invoice"),
    [agents]
  );

  const urlAgentId = searchParams.get("agentId");

  /** Prefer URL agent; else the only invoice-template agent (if unique). */
  useEffect(() => {
    if (agents.length === 0) return;

    if (urlAgentId) {
      const agent = agents.find((a) => a.id === urlAgentId);
      if (agent) {
        setAgentId(urlAgentId);
        setWalletId(agent.assignedWalletId);
      }
      return;
    }

    if (invoiceAgents.length === 1) {
      const only = invoiceAgents[0];
      setAgentId(only.id);
      setWalletId(only.assignedWalletId);
    }
  }, [agents, invoiceAgents, urlAgentId]);

  const boundAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);
  const boundWallet = useMemo(() => wallets.find((w) => w.id === walletId), [wallets, walletId]);

  useEffect(() => {
    if (!extraction) return;
    const inv = extraction.invoiceNumber ?? "—";
    const v = extraction.vendor ?? "vendor";
    setPurpose((p) => (p.trim() ? p : `Settle invoice ${inv} from ${v} (uploaded document)`));
  }, [extraction]);

  const uploadMutation = useMutation({
    mutationFn: (f: File) => uploadInvoice(f),
    onSuccess: (res) => {
      setFileId(res.fileId);
    },
  });

  const extractMutation = useMutation({
    mutationFn: (id: string) => extractInvoice(id),
    onSuccess: setExtraction,
  });

  const requestMutation = useMutation({
    mutationFn: (body: Parameters<typeof requestTransaction>[0]) =>
      requestTransaction(body),
    onSuccess: (tx) => {
      setSubmitError(null);
      setTxResult(tx);
    },
    onError: (e) => {
      setSubmitError(e instanceof Error ? e.message : "Request failed");
    },
  });

  useEffect(() => {
    if (!txResult) return;
    submitResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [txResult]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileId(null);
      setExtraction(null);
      setTxResult(null);
      setPurpose("");
      setPayeeOverrideId("");
    }
  }

  function handleUpload() {
    if (!file) return;
    uploadMutation.mutate(file);
  }

  function handleExtract() {
    if (fileId) extractMutation.mutate(fileId);
  }

  function handleSubmitRequest() {
    setSubmitError(null);
    if (extraction?.amount == null || Number.isNaN(extraction.amount)) {
      setSubmitError("Missing amount on extraction — re-run extract or fix fields.");
      return;
    }
    if (!walletId || !agentId) {
      setSubmitError("No invoice agent selected. Create one with the Invoice template or open this page from the agent’s “Invoice upload” link.");
      return;
    }
    const wallet = wallets.find((w) => w.id === walletId);
    const trust = buildInvoiceTrustFields({
      extraction,
      purpose: purpose.trim(),
      fileId,
      originalFilename: file?.name,
      payeeOverrideId,
      agentName: boundAgent?.name,
    });
    requestMutation.mutate({
      agentId,
      walletId,
      amount: extraction.amount,
      currency: wallet?.currency ?? "USD",
      vendor: extraction.vendor,
      memo: extraction.memo,
      purpose: purpose.trim() || undefined,
      payeeId: payeeOverrideId || undefined,
      sourceKind: "invoice_upload",
      context: {
        source: "invoice_agent",
        fileId: fileId ?? undefined,
        invoiceNumber: extraction.invoiceNumber,
        dueDate: extraction.dueDate,
        extractionConfidence: extraction.confidence,
        originalFilename: file?.name,
        trustBrief:
          "Invoice template submission with default citations (workflow, evidence, purpose, payee rules) and agentDecision trace.",
      },
      evidence: fileId
        ? [{ type: "invoice", fileId, filename: file?.name, ...extraction }]
        : undefined,
      citedRules: trust.citedRules,
      agentDecision: trust.agentDecision,
    });
  }

  const headerAgentName = boundAgent?.name;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice template</p>
        <h1 className="mt-1 text-heading-1 text-foreground">
          {headerAgentName ? headerAgentName : urlAgentId ? "Invoice agent" : "Invoice workspace"}
        </h1>
        {headerAgentName ? (
          <p className="mt-1 text-body-sm text-foreground">
            You’re filing invoice requests as this agent
            {boundWallet ? (
              <>
                {" "}
                · wallet <span className="font-medium">{boundWallet.name}</span>
              </>
            ) : null}
            .{" "}
            <Link
              href={`/agents/${agentId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Agent profile
            </Link>
          </p>
        ) : urlAgentId && !boundAgent ? (
          <p className="mt-1 text-body-sm text-amber-800 dark:text-amber-200">
            This link’s agent was not found. Open the invoice flow from{" "}
            <Link href="/agents" className="font-medium underline underline-offset-4">
              Agents
            </Link>{" "}
            or pick an agent below.
          </p>
        ) : (
          <p className="mt-1 text-body-sm text-muted-foreground">
            Choose which invoice agent you’re using (or create one), then upload and extract. Requests are attributed
            to that agent and its wallet.
          </p>
        )}
        <p className="mt-2 text-body-sm text-muted-foreground">
          Upload an invoice, extract fields, and submit a payment request — full audit trail on the transaction.
        </p>
        <p className="mt-2 text-caption text-muted-foreground">
          <Link href="/payees" className="font-medium text-primary underline-offset-4 hover:underline">
            Manage approved payees
          </Link>{" "}
          so vendor strings match your directory (or require a match in wallet policy).
        </p>
        {boundAgent && urlAgentId && (
          <p className="mt-2 text-caption text-muted-foreground">
            Opened from this agent’s link — wallet and identity stay tied to it.
          </p>
        )}
        {boundAgent && !urlAgentId && invoiceAgents.length === 1 && (
          <p className="mt-2 text-caption text-muted-foreground">
            This workspace has one invoice agent — it’s selected automatically.
          </p>
        )}
        {boundAgent && !urlAgentId && invoiceAgents.length > 1 && (
          <p className="mt-2 text-caption text-muted-foreground">
            Several invoice agents exist — pick which one you’re using in the form below (title updates when you
            change it).
          </p>
        )}
        {invoiceAgents.length === 0 && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            No agent with template <span className="font-mono">invoice</span> yet.{" "}
            <Link href="/agents?create=1" className="font-medium underline underline-offset-4">
              Create an agent
            </Link>{" "}
            and choose <strong>Invoice Agent</strong>, then return here.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload invoice
            </CardTitle>
            <CardDescription>
              Image or PDF. Extraction is performed via API (OCR).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="max-w-xs"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? "Uploading…" : "Upload"}
              </Button>
            </div>
            {file && (
              <p className="text-body-sm text-muted-foreground">
                Selected: {file.name}
              </p>
            )}
            {fileId && (
              <Button
                variant="outline"
                onClick={handleExtract}
                disabled={extractMutation.isPending}
              >
                {extractMutation.isPending ? "Extracting…" : "Extract fields"}
              </Button>
            )}
          </CardContent>
        </Card>

        {extraction && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Extracted fields
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-body-sm">
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p>{extraction.vendor ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice #</Label>
                  <p>{extraction.invoiceNumber ?? "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p>
                    {extraction.amount != null
                      ? formatCurrency(extraction.amount)
                      : "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due date</Label>
                  <p>{extraction.dueDate ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Memo</Label>
                  <p>{extraction.memo ?? "—"}</p>
                </div>
                {extraction.confidence != null && (
                  <div>
                    <Label className="text-muted-foreground">Confidence</Label>
                    <p>{Math.round(extraction.confidence * 100)}%</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Label className="text-muted-foreground">Purpose (audit — why this payment)</Label>
                <Textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  placeholder="Shown on the transaction audit trail"
                />
                <Label className="text-muted-foreground">Submit payment request</Label>
                {boundAgent && boundWallet ? (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Agent</span>{" "}
                      <span className="font-medium text-foreground">{boundAgent.name}</span>
                      <span className="text-muted-foreground"> · wallet </span>
                      <span className="font-medium text-foreground">{boundWallet.name}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Wallet always matches the agent’s assignment.{" "}
                      <Link href={`/agents/${boundAgent.id}`} className="text-primary underline-offset-4 hover:underline">
                        Change agent or wallet
                      </Link>
                    </p>
                  </div>
                ) : null}
                {invoiceAgents.length > 1 && !urlAgentId ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Invoice agent (template)</Label>
                    <select
                      className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={agentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setAgentId(id);
                        const a = agents.find((x) => x.id === id);
                        if (a) setWalletId(a.assignedWalletId);
                      }}
                    >
                      <option value="">Select invoice agent</option>
                      {invoiceAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {urlAgentId && !boundAgent ? (
                  <p className="text-sm text-destructive">
                    Linked agent not found — open from Agents or pick an invoice agent after creating one.
                  </p>
                ) : null}
                {submitError ? (
                  <div
                    className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                ) : null}
                <div>
                  <Label className="text-muted-foreground">Override approved payee (optional)</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-md"
                    value={payeeOverrideId}
                    onChange={(e) => setPayeeOverrideId(e.target.value)}
                  >
                    <option value="">Auto-match from vendor string</option>
                    {payees
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  onClick={() => handleSubmitRequest()}
                  disabled={
                    requestMutation.isPending ||
                    !walletId ||
                    !agentId ||
                    extraction.amount == null ||
                    (!urlAgentId && invoiceAgents.length === 0)
                  }
                >
                  {requestMutation.isPending ? "Submitting…" : "Submit request"}
                </Button>

                {txResult ? (
                  <div
                    ref={submitResultRef}
                    className="space-y-3 rounded-lg border border-emerald-600/25 bg-emerald-600/5 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                        aria-hidden
                      />
                      <div>
                        <p className="font-semibold text-foreground">Request submitted</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Custos recorded this spend request. Policy outcome:
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0 sm:ml-7">
                      <TransactionStatusBadge status={txResult.status} />
                      {txResult.policyResult ? (
                        <span className="text-sm text-muted-foreground">
                          {txResult.policyResult.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </div>
                    <div className="pl-7 sm:pl-0 sm:ml-7">
                      <Button size="sm" asChild>
                        <Link href={`/transactions/${txResult.id}`}>Open transaction</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
