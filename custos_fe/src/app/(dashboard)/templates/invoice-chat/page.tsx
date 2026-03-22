"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Bot, Paperclip, Send, Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadInvoice, extractInvoice, invoiceChatTurn, type InvoiceChatMessage } from "@/lib/api/invoice";
import { requestTransaction } from "@/lib/api/transactions";
import { getPayees } from "@/lib/api/payees";
import type { InvoiceExtractionResult } from "@/lib/types";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getWallets } from "@/lib/api/wallets";
import { getAgents } from "@/lib/api/agents";
import { buildInvoiceTrustFields } from "@/lib/invoiceSubmissionTrust";

function mid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeExtractionPatch(
  prev: InvoiceExtractionResult | null,
  patch: Record<string, unknown>
): InvoiceExtractionResult | null {
  if (!prev) return null;
  const n: InvoiceExtractionResult = { ...prev };
  if (typeof patch.vendor === "string") n.vendor = patch.vendor;
  if (typeof patch.invoiceNumber === "string") n.invoiceNumber = patch.invoiceNumber;
  if (typeof patch.memo === "string") n.memo = patch.memo;
  if (typeof patch.dueDate === "string") n.dueDate = patch.dueDate;
  if (typeof patch.amount === "number" && Number.isFinite(patch.amount)) n.amount = patch.amount;
  if (typeof patch.confidence === "number" && Number.isFinite(patch.confidence)) n.confidence = patch.confidence;
  if (typeof patch.railType === "string") n.railType = patch.railType;
  return n;
}

function extractionFollowUp(ex: InvoiceExtractionResult): string {
  return [
    "I read the document. Here’s my draft:",
    `• Vendor: ${ex.vendor ?? "unknown"}`,
    `• Invoice #: ${ex.invoiceNumber ?? "—"}`,
    `• Amount: ${ex.amount != null ? String(ex.amount) : "—"}`,
    ex.dueDate ? `• Due: ${ex.dueDate}` : "• Due: not visible (tell me if you have one)",
    "",
    "Adjust anything in plain English, or say submit when you want this filed as a payment request.",
  ].join("\n");
}

type ChatRow = { id: string; role: "user" | "assistant"; content: string };

export default function InvoiceChatTemplatePage() {
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<InvoiceExtractionResult | null>(null);
  const [messages, setMessages] = useState<ChatRow[]>(() => [
    {
      id: mid(),
      role: "assistant",
      content:
        "Hi — I’m your Invoice Copilot. Drop an invoice image, I’ll extract it, then we can fix any field together before you submit the payment request through Custos policy.",
    },
  ]);
  const [input, setInput] = useState("");
  const [txResult, setTxResult] = useState<Awaited<ReturnType<typeof requestTransaction>> | null>(null);
  const [walletId, setWalletId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [payeeOverrideId, setPayeeOverrideId] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const chatAgents = useMemo(
    () => agents.filter((a) => a.templateType === "invoice_chat"),
    [agents]
  );
  const urlAgentId = searchParams.get("agentId");

  useEffect(() => {
    fileRef.current = file;
  }, [file]);

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
    if (chatAgents.length === 1) {
      const only = chatAgents[0];
      setAgentId(only.id);
      setWalletId(only.assignedWalletId);
    }
  }, [agents, chatAgents, urlAgentId]);

  const boundAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);
  const boundWallet = useMemo(() => wallets.find((w) => w.id === walletId), [wallets, walletId]);

  useEffect(() => {
    if (!extraction) return;
    const inv = extraction.invoiceNumber ?? "—";
    const v = extraction.vendor ?? "vendor";
    setPurpose((p) => (p.trim() ? p : `Settle invoice ${inv} from ${v} (Invoice Copilot)`));
  }, [extraction]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const extractMutation = useMutation({
    mutationFn: (id: string) => extractInvoice(id),
    onSuccess: (data) => {
      setExtraction(data);
      const name = fileRef.current?.name ?? "invoice";
      setMessages((prev) => [
        ...prev,
        { id: mid(), role: "user", content: `Uploaded ${name}.` },
        { id: mid(), role: "assistant", content: extractionFollowUp(data) },
      ]);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (f: File) => uploadInvoice(f),
    onSuccess: (res) => {
      setFileId(res.fileId);
      extractMutation.mutate(res.fileId);
    },
  });

  const chatMutation = useMutation({
    mutationFn: (msgs: InvoiceChatMessage[]) =>
      invoiceChatTurn({
        messages: msgs,
        extraction: extraction as Record<string, unknown> | null,
      }),
  });

  const requestMutation = useMutation({
    mutationFn: (body: Parameters<typeof requestTransaction>[0]) => requestTransaction(body),
    onSuccess: (tx) => {
      setSubmitError(null);
      setTxResult(tx);
    },
    onError: (e) => {
      setSubmitError(e instanceof Error ? e.message : "Request failed");
    },
  });

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

  function handleUploadAnalyze() {
    if (!file) return;
    uploadMutation.mutate(file);
  }

  async function handleSendChat() {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;
    const userMsg: ChatRow = { id: mid(), role: "user", content: text };
    const nextThread = [...messages, userMsg];
    setMessages(nextThread);
    setInput("");
    const apiMessages: InvoiceChatMessage[] = nextThread.map(({ role, content }) => ({ role, content }));
    try {
      const { reply, patch } = await chatMutation.mutateAsync(apiMessages);
      setExtraction((prev) => mergeExtractionPatch(prev, patch));
      setMessages((prev) => [...prev, { id: mid(), role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: mid(),
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Try again.",
        },
      ]);
    }
  }

  function handleSubmitRequest() {
    setSubmitError(null);
    if (extraction?.amount == null || Number.isNaN(extraction.amount)) {
      setSubmitError("Need a numeric amount — fix extraction in chat or re-upload.");
      return;
    }
    if (!walletId || !agentId) {
      setSubmitError("Select an Invoice Copilot agent (template invoice_chat) or open this page from the agent menu.");
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
      viaChat: true,
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
      sourceKind: "invoice_chat",
      context: {
        source: "invoice_chat_agent",
        fileId: fileId ?? undefined,
        invoiceNumber: extraction.invoiceNumber,
        dueDate: extraction.dueDate,
        extractionConfidence: extraction.confidence,
        originalFilename: file?.name,
        trustBrief:
          "Invoice Copilot (chat): conversational refinement before submit; same policy stack as classic invoice template.",
      },
      evidence: fileId
        ? [{ type: "invoice", fileId, filename: file?.name, ...extraction }]
        : undefined,
      citedRules: trust.citedRules,
      agentDecision: trust.agentDecision,
    });
  }

  const headerName = boundAgent?.name;

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice Copilot</p>
        <h1 className="mt-1 text-heading-1 text-foreground">
          {headerName ? headerName : urlAgentId ? "Invoice Copilot" : "Invoice chat workspace"}
        </h1>
        <p className="mt-2 max-w-2xl text-body-sm text-muted-foreground">
          More agentic than the classic upload form: share an image, talk through corrections, then submit the same
          governed transaction. Optional: set <code className="text-xs">OPENAI_API_KEY</code> on the API for richer chat
          (heuristics work offline).
        </p>
        <p className="mt-2 text-caption text-muted-foreground">
          <Link href="/templates/invoice" className="text-primary underline-offset-4 hover:underline">
            Prefer the structured form?
          </Link>{" "}
          ·{" "}
          <Link href="/payees" className="text-primary underline-offset-4 hover:underline">
            Approved payees
          </Link>
        </p>
      </div>

      {chatAgents.length === 0 && (
        <Card className="border-dashed border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Create an Invoice Copilot agent</CardTitle>
            <CardDescription>
              Add an agent from template <span className="font-mono">invoice_chat</span>, assign a wallet, then return
              here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/agents">Go to agents</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(280px,340px)]">
        <Card className="overflow-hidden border-border/80 bg-gradient-to-b from-card to-muted/20 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Conversation
            </CardTitle>
            <CardDescription>Upload once, then chat to refine fields before submit.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-0">
            <ScrollArea className="h-[min(52vh,420px)] px-4 py-3">
              <ul className="space-y-3 pr-2">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role === "assistant" && (
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-950 shadow-sm ring-1 ring-black/5 dark:bg-neutral-800 dark:text-neutral-50 dark:ring-white/10">
                        <Bot className="h-4 w-4" strokeWidth={2} />
                      </span>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "border border-border bg-background/90 text-foreground rounded-bl-md shadow-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </li>
                ))}
                <div ref={bottomRef} />
              </ul>
            </ScrollArea>

            <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" accept="image/*,.pdf" className="hidden" id="inv-chat-file" onChange={handleFileChange} />
                <Button type="button" variant="outline" size="sm" asChild>
                  <label htmlFor="inv-chat-file" className="cursor-pointer">
                    <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                    Attach
                  </label>
                </Button>
                {file ? (
                  <span className="text-caption text-muted-foreground truncate max-w-[200px]">{file.name}</span>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUploadAnalyze}
                  disabled={!file || uploadMutation.isPending || extractMutation.isPending}
                >
                  {uploadMutation.isPending || extractMutation.isPending ? "Reading…" : "Upload & read"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder="e.g. vendor is Custos AI, amount is 42, submit when ready…"
                  rows={2}
                  className="min-h-[72px] resize-none text-sm"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="button"
                  className="shrink-0 self-end"
                  size="icon"
                  onClick={() => void handleSendChat()}
                  disabled={chatMutation.isPending || !input.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live extraction</CardTitle>
              <CardDescription>Updates from OCR and from chat patches.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {extraction ? (
                <ul className="space-y-1 text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Vendor:</span> {extraction.vendor ?? "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Invoice #:</span> {extraction.invoiceNumber ?? "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Amount:</span>{" "}
                    {extraction.amount != null ? formatCurrency(extraction.amount, boundWallet?.currency ?? "USD") : "—"}
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Due:</span> {extraction.dueDate || "—"}
                  </li>
                  {extraction.confidence != null && (
                    <li className="text-caption">Confidence: {Math.round(extraction.confidence * 100)}%</li>
                  )}
                </ul>
              ) : (
                <p className="text-caption text-muted-foreground">No extraction yet — upload an invoice image.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">File &amp; submit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-muted-foreground">Purpose (audit)</Label>
                <Textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={2}
                  className="mt-1 resize-none text-sm"
                />
              </div>
              {chatAgents.length > 1 && !urlAgentId ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Invoice Copilot agent</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={agentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setAgentId(id);
                      const a = agents.find((x) => x.id === id);
                      if (a) setWalletId(a.assignedWalletId);
                    }}
                  >
                    <option value="">Select agent</option>
                    {chatAgents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {boundAgent && boundWallet ? (
                <p className="text-caption text-muted-foreground">
                  Wallet: <span className="font-medium text-foreground">{boundWallet.name}</span> ·{" "}
                  <Link href={`/agents/${boundAgent.id}`} className="text-primary underline-offset-4 hover:underline">
                    Agent settings
                  </Link>
                </p>
              ) : null}
              <div>
                <Label className="text-muted-foreground">Override payee (optional)</Label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={payeeOverrideId}
                  onChange={(e) => setPayeeOverrideId(e.target.value)}
                >
                  <option value="">Auto-match vendor</option>
                  {payees
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                </select>
              </div>
              {submitError ? (
                <div
                  className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              ) : null}
              <Button
                onClick={handleSubmitRequest}
                disabled={
                  requestMutation.isPending ||
                  !walletId ||
                  !agentId ||
                  extraction?.amount == null ||
                  chatAgents.length === 0
                }
              >
                {requestMutation.isPending ? "Submitting…" : "Submit payment request"}
              </Button>

              {txResult ? (
                <div
                  className="space-y-3 rounded-lg border border-emerald-600/25 bg-emerald-600/5 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  role="status"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold text-foreground">Request submitted</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <TransactionStatusBadge status={txResult.status} />
                        {txResult.policyResult ? (
                          <span className="text-sm text-muted-foreground">
                            {txResult.policyResult.replace(/_/g, " ")}
                          </span>
                        ) : null}
                      </div>
                      <Button size="sm" className="mt-2" asChild>
                        <Link href={`/transactions/${txResult.id}`}>Open transaction</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
