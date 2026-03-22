/**
 * Event production planner — POST /plan
 * JSON body: { eventName?, notes?, documentsText }
 * Returns draft payables for Custos transaction requests (risk + trust fields included).
 */
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "512kb" }));
const port = Number(process.env.PORT ?? 4002);

function lineRisk(amount: number, confidence: number): number {
  const base = Math.round(50 - confidence * 15 + (amount > 15000 ? 18 : amount > 8000 ? 10 : 0));
  return Math.min(100, Math.max(0, base));
}

function mockPlan(body: { eventName?: string; notes?: string; documentsText: string }) {
  const eventName = body.eventName?.trim() || "Demo festival";
  return {
    eventId: `evt_${Date.now().toString(36)}`,
    eventName,
    summary: "2 mock vendor lines (set OPENAI_API_KEY for extraction).",
    payables: [
      {
        vendor: "Metro Stage Rentals",
        role: "production",
        amount: 2800,
        memo: "Backline & risers",
        confidence: 0.5,
        lineRiskScore: lineRisk(2800, 0.5),
      },
      {
        vendor: "Brightline Security",
        role: "ops",
        amount: 1900,
        memo: "Event security — 2 nights",
        confidence: 0.52,
        lineRiskScore: lineRisk(1900, 0.52),
      },
    ],
    aggregateRiskScore: 46,
    riskFlags: ["document_quality_low"],
    agentDecision: {
      summary: `Heuristic plan for "${eventName}"`,
      reasoning: body.notes?.trim() || "OpenAI not configured — returning demo payables.",
      modelConfidence: 0.45,
    },
  };
}

app.post("/plan", async (req, res) => {
  try {
    const documentsText = typeof req.body?.documentsText === "string" ? req.body.documentsText : "";
    if (!documentsText.trim()) {
      res.status(400).json({ message: "documentsText is required" });
      return;
    }
    const eventName = typeof req.body?.eventName === "string" ? req.body.eventName : undefined;
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json(mockPlan({ eventName, notes, documentsText }));
      return;
    }

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You output JSON only, no markdown. Given event budget / vendor text, produce vendor payables for a production finance workflow.",
        },
        {
          role: "user",
          content: `Extract vendor payment lines. Return JSON with keys:
eventName (string, inferred or from input),
summary (one sentence),
payables (array of { vendor, role, amount (number USD), memo, confidence 0-1 }),
aggregateRiskScore (0-100 integer, higher = needs more human review),
riskFlags (string array, e.g. high_value, new_vendor, document_quality_low),
agentDecision: { summary, reasoning, modelConfidence 0-1 }.

Event name hint: ${eventName ?? ""}
Operator notes: ${notes ?? ""}

Document text:
---
${documentsText.slice(0, 12000)}
---`,
        },
      ],
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim()) as Record<string, unknown>;
    } catch {
      res.status(500).json({ message: "Model returned non-JSON" });
      return;
    }

    const payablesRaw = Array.isArray(parsed.payables) ? parsed.payables : [];
    const payables = payablesRaw.map((row) => {
      const r = row as Record<string, unknown>;
      const vendor = String(r.vendor ?? "Unknown vendor");
      const amount = typeof r.amount === "number" ? r.amount : Number(r.amount) || 0;
      const confidence =
        typeof r.confidence === "number" ? r.confidence : Number(r.confidence) || 0.7;
      return {
        vendor,
        role: r.role != null ? String(r.role) : undefined,
        amount,
        memo: r.memo != null ? String(r.memo) : undefined,
        confidence: Math.min(1, Math.max(0, confidence)),
        lineRiskScore: lineRisk(amount, Math.min(1, Math.max(0, confidence))),
      };
    });

    const agg =
      typeof parsed.aggregateRiskScore === "number"
        ? Math.round(parsed.aggregateRiskScore)
        : payables.length
          ? Math.round(payables.reduce((s, p) => s + p.lineRiskScore, 0) / payables.length)
          : 50;

    const riskFlags = Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map(String) : [];
    const ad = parsed.agentDecision as Record<string, unknown> | undefined;

    res.json({
      eventId: `evt_${Date.now().toString(36)}`,
      eventName: String(parsed.eventName ?? eventName ?? "Event"),
      summary: String(parsed.summary ?? `${payables.length} payables`),
      payables,
      aggregateRiskScore: Math.min(100, Math.max(0, agg)),
      riskFlags,
      agentDecision: {
        summary: String(ad?.summary ?? "Event payout plan"),
        reasoning: ad?.reasoning != null ? String(ad.reasoning) : undefined,
        modelConfidence:
          typeof ad?.modelConfidence === "number"
            ? Math.min(1, Math.max(0, ad.modelConfidence))
            : 0.75,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e instanceof Error ? e.message : "plan failed" });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`custos_agents event_production listening on ${port} (POST /plan)`);
});
