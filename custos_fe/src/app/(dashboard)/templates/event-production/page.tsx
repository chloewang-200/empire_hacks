"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { planEventProduction } from "@/lib/api/eventProduction";
import { requestTransaction } from "@/lib/api/transactions";
import type { EventProductionPlanResult, EventPayableLine, TransactionStatus } from "@/lib/types";
import { TransactionStatusBadge } from "@/components/status/StatusBadge";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getWallets } from "@/lib/api/wallets";
import { getAgents } from "@/lib/api/agents";

const EVENT_CATEGORY = "events_production";

export default function EventProductionAgentPage() {
  const searchParams = useSearchParams();
  const [eventName, setEventName] = useState("");
  const [notes, setNotes] = useState("");
  const [documentsText, setDocumentsText] = useState("");
  const [plan, setPlan] = useState<EventProductionPlanResult | null>(null);
  const [walletId, setWalletId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [submitLog, setSubmitLog] = useState<
    { vendor: string; ok: boolean; id?: string; status?: TransactionStatus; message?: string }[]
  >([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const { data: walletsData } = useQuery({
    queryKey: ["wallets", { page: 1, pageSize: 100 }],
    queryFn: () => getWallets({ page: 1, pageSize: 100 }),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["agents", { page: 1, pageSize: 100 }],
    queryFn: () => getAgents({ page: 1, pageSize: 100 }),
  });
  const wallets = walletsData?.data ?? [];
  const agents = agentsData?.data ?? [];

  useEffect(() => {
    const fromUrl = searchParams.get("agentId");
    if (!fromUrl || agents.length === 0) return;
    const agent = agents.find((a) => a.id === fromUrl);
    if (agent) {
      setAgentId(fromUrl);
      setWalletId(agent.assignedWalletId);
    }
  }, [searchParams, agents]);

  const planMutation = useMutation({
    mutationFn: (body: { eventName?: string; notes?: string; documentsText: string }) =>
      planEventProduction(body),
    onSuccess: (p) => {
      setPlan(p);
      setSubmitLog([]);
    },
  });

  async function handleSubmitAll() {
    if (!plan?.payables.length || !walletId || !agentId) return;
    const wallet = wallets.find((w) => w.id === walletId);
    const currency = wallet?.currency ?? "USD";
    setBatchRunning(true);
    setSubmitLog([]);
    const log: {
      vendor: string;
      ok: boolean;
      id?: string;
      status?: TransactionStatus;
      message?: string;
    }[] = [];
    const citedRules = [
      {
        id: "evt-budget-routing",
        title: "Event vendor payouts via Custos",
        source: "event_production_template",
        excerpt: "Each line is a separate spend request; policy, risk, and payout rails apply before money moves.",
      },
    ];

    for (let i = 0; i < plan.payables.length; i++) {
      const line = plan.payables[i];
      const idempotencyKey = `${plan.eventId}_line_${i}`;
      const lineFlags = [...plan.riskFlags];
      if (line.confidence < 0.65) lineFlags.push("document_quality_low");
      if (line.amount >= 10000) lineFlags.push("high_value");

      try {
        const tx = await requestTransaction({
          agentId,
          walletId,
          amount: line.amount,
          currency,
          vendor: line.vendor,
          category: EVENT_CATEGORY,
          memo: line.memo ?? `${line.role ?? "vendor"} — ${plan.eventName}`,
          purpose: `Event payout: ${plan.eventName} — ${line.vendor} (${plan.summary})`,
          sourceKind: "event_production_plan",
          idempotencyKey,
          riskScore: line.lineRiskScore,
          riskFlags: Array.from(new Set(lineFlags)),
          citedRules,
          agentDecision: {
            summary: plan.agentDecision.summary,
            reasoning: `${plan.agentDecision.reasoning ?? ""} Line ${i + 1}/${plan.payables.length}: ${line.vendor}.`,
            modelConfidence: plan.agentDecision.modelConfidence,
          },
          context: {
            source: "event_production_agent",
            eventId: plan.eventId,
            eventName: plan.eventName,
            lineIndex: i,
            aggregateRiskScore: plan.aggregateRiskScore,
            payable: line as unknown as Record<string, unknown>,
          },
          evidence: [
            {
              type: "event_production_plan",
              eventId: plan.eventId,
              snippet: documentsText.slice(0, 2000),
            },
          ],
        });
        log.push({ vendor: line.vendor, ok: true, id: tx.id, status: tx.status });
      } catch (e) {
        log.push({
          vendor: line.vendor,
          ok: false,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    setSubmitLog(log);
    setBatchRunning(false);
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="text-heading-1 text-foreground">Event production payouts</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Paste a budget, vendor roster, or contract excerpts. We draft payables locally or via the optional event worker;
          you then send each line through Custos for policy, risk score, and payout execution.
        </p>
        <p className="mt-2 text-caption text-muted-foreground">
          <Link href="/payees" className="link-readable">
            Approved payees
          </Link>{" "}
          should list your vendors (aliases help auto-match). Wallet policy still applies per line.
        </p>
        {searchParams.get("agentId") && (
          <p className="mt-2 text-caption text-muted-foreground">
            Agent and wallet pre-filled from your link (dashboard session).
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              Event inputs
            </CardTitle>
            <CardDescription>
              Tip: paste lines like <span className="font-mono text-xs">AV Crew LLC — $4,200</span> for quick parsing
              without the LLM worker.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="evt-name">Event name</Label>
              <Input
                id="evt-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Spring Summit 2025"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="evt-notes">Notes for the planner (optional)</Label>
              <Textarea
                id="evt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 resize-none text-sm"
                placeholder="e.g. Final numbers per signed vendor agreement"
              />
            </div>
            <div>
              <Label htmlFor="evt-docs">Budget / vendor text</Label>
              <Textarea
                id="evt-docs"
                value={documentsText}
                onChange={(e) => setDocumentsText(e.target.value)}
                rows={12}
                className="mt-1 resize-none font-mono text-xs"
                placeholder="Paste roster, CSV-like lines, or contract snippets…"
              />
            </div>
            <Button
              onClick={() =>
                planMutation.mutate({
                  eventName: eventName.trim() || undefined,
                  notes: notes.trim() || undefined,
                  documentsText,
                })
              }
              disabled={!documentsText.trim() || planMutation.isPending}
            >
              {planMutation.isPending ? "Planning…" : "Generate payables"}
            </Button>
          </CardContent>
        </Card>

        {plan && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Draft payables</CardTitle>
              <CardDescription>
                {plan.summary} Aggregate risk score:{" "}
                <span className="font-medium text-foreground">{plan.aggregateRiskScore}</span>
                {plan.riskFlags.length > 0 && (
                  <span className="block mt-1 text-xs">
                    Flags: {plan.riskFlags.join(", ")}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">{plan.agentDecision.summary}</p>
                {plan.agentDecision.reasoning && (
                  <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                    {plan.agentDecision.reasoning}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Model confidence:{" "}
                  {Math.round((plan.agentDecision.modelConfidence ?? 0) * 100)}%
                </p>
              </div>

              <ul className="space-y-2 text-sm">
                {plan.payables.map((p: EventPayableLine, i: number) => (
                  <li
                    key={`${p.vendor}-${i}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{p.vendor}</span>
                      {p.role && (
                        <span className="ml-2 text-xs text-muted-foreground">({p.role})</span>
                      )}
                      {p.memo && <p className="text-xs text-muted-foreground mt-0.5">{p.memo}</p>}
                    </div>
                    <div className="text-right text-xs">
                      <div>{formatCurrency(p.amount)}</div>
                      <div className="text-muted-foreground">
                        line risk {p.lineRiskScore} · conf {Math.round(p.confidence * 100)}%
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-muted-foreground">Submit through Custos</Label>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                  >
                    <option value="">Select wallet</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[180px]"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">Select agent</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.templateType === "event_production" ? " · event template" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Creates one transaction per row with{" "}
                  <code className="rounded bg-muted px-1">idempotencyKey</code>, risk score, flags, and citations.
                </p>
                <Button
                  onClick={() => void handleSubmitAll()}
                  disabled={batchRunning || !walletId || !agentId || !plan.payables.length}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {batchRunning ? "Submitting…" : "Submit all to Custos"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {submitLog.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Submission results</CardTitle>
            <CardDescription>Each line is its own transaction in the ledger.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {submitLog.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{row.vendor}</span>
                {row.ok && row.id ? (
                  <>
                    <TransactionStatusBadge status={row.status ?? "pending_review"} />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/transactions/${row.id}`}>Open</Link>
                    </Button>
                  </>
                ) : (
                  <span className="text-destructive text-xs">{row.message ?? "Failed"}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
