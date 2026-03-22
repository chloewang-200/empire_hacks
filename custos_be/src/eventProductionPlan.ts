/**
 * Event production payout planner — mock or optional worker (CUSTOS_EVENT_AGENT_URL).
 * Returns vendor lines for the dashboard to submit as separate Custos transactions.
 */

export interface EventPayableLine {
  vendor: string;
  role?: string;
  amount: number;
  memo?: string;
  confidence: number;
  /** 0–100 per-line heuristic for trust layer */
  lineRiskScore: number;
}

export interface EventProductionPlanResult {
  eventId: string;
  eventName: string;
  summary: string;
  payables: EventPayableLine[];
  aggregateRiskScore: number;
  riskFlags: string[];
  agentDecision: {
    summary: string;
    reasoning?: string;
    modelConfidence: number;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function naiveParseLines(text: string): EventPayableLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: EventPayableLine[] = [];
  const re = /^(.+?)[\t:|,]+\s*\$?\s*([\d,]+\.?\d*)\s*$/i;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const vendor = m[1].trim().replace(/^[-*]\s*/, "");
    const amount = Number(m[2].replace(/,/g, ""));
    if (!vendor || !Number.isFinite(amount) || amount <= 0) continue;
    const confidence = 0.72;
    const lineRiskScore = clamp(Math.round(55 - confidence * 20 + (amount > 10000 ? 15 : 0)), 0, 100);
    out.push({
      vendor,
      amount,
      memo: "Parsed from pasted budget line",
      confidence,
      lineRiskScore,
    });
  }
  return out;
}

function mockPlan(input: {
  eventName?: string;
  notes?: string;
  documentsText: string;
}): EventProductionPlanResult {
  const eventName = input.eventName?.trim() || "Untitled event";
  const parsed = naiveParseLines(input.documentsText);
  const payables =
    parsed.length > 0
      ? parsed
      : [
          {
            vendor: "City Audio Visual",
            role: "production",
            amount: 4200,
            memo: "Stage & sound package (mock line — paste “Vendor — $1234” lines or run event worker)",
            confidence: 0.55,
            lineRiskScore: 52,
          },
          {
            vendor: "Summit Catering Co",
            role: "catering",
            amount: 3100.5,
            memo: "Reception dinner — 150 guests (mock)",
            confidence: 0.58,
            lineRiskScore: 48,
          },
        ];

  const total = payables.reduce((s, p) => s + p.amount, 0);
  const avgConf = payables.reduce((s, p) => s + p.confidence, 0) / payables.length;
  const aggregateRiskScore = clamp(
    Math.round(payables.reduce((s, p) => s + p.lineRiskScore, 0) / payables.length + (parsed.length ? -5 : 8)),
    0,
    100
  );

  return {
    eventId: `evt_${Date.now().toString(36)}`,
    eventName,
    summary: `${payables.length} vendor line(s), about $${total.toFixed(2)} total${parsed.length ? " (from pasted lines)" : " (demo defaults)"}.`,
    payables,
    aggregateRiskScore,
    riskFlags: avgConf < 0.65 ? ["document_quality_low"] : [],
    agentDecision: {
      summary: `Draft event payout schedule for "${eventName}"`,
      reasoning:
        input.notes?.trim() ||
        (parsed.length
          ? "Parsed vendor amounts from free-text budget lines."
          : "No structured lines detected — showing demo payables. Paste lines like “DJ Morgan — 1200” or configure CUSTOS_EVENT_AGENT_URL."),
      modelConfidence: clamp(avgConf, 0, 1),
    },
  };
}

export async function runEventProductionPlan(input: {
  eventName?: string;
  notes?: string;
  documentsText: string;
}): Promise<EventProductionPlanResult> {
  const url = process.env.CUSTOS_EVENT_AGENT_URL?.trim();
  if (url) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: input.eventName,
        notes: input.notes,
        documentsText: input.documentsText,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(t.slice(0, 500) || `Event planner HTTP ${r.status}`);
    }
    return (await r.json()) as EventProductionPlanResult;
  }
  return mockPlan(input);
}
