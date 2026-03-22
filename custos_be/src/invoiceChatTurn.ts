/**
 * Conversational turn for the Invoice Copilot template — heuristics always work;
 * set OPENAI_API_KEY for richer, context-aware replies (optional).
 */

export type InvoiceChatMessage = { role: "user" | "assistant"; content: string };

export type InvoiceChatTurnResult = {
  reply: string;
  patch: Record<string, unknown>;
};

function extractionSummary(ex: Record<string, unknown> | null): string {
  if (!ex || Object.keys(ex).length === 0) return "(no extraction yet — user should upload an invoice image)";
  try {
    return JSON.stringify(ex, null, 0);
  } catch {
    return String(ex);
  }
}

function parseAmount(text: string): number | undefined {
  const m = text.match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function heuristicTurn(
  messages: InvoiceChatMessage[],
  extraction: Record<string, unknown> | null
): InvoiceChatTurnResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";
  const lower = lastUser.toLowerCase();
  const patch: Record<string, unknown> = {};

  if (/submit|file the request|send (to )?custos|request payment|pay (this|it)|looks good|go ahead/.test(lower)) {
    return {
      reply:
        "Great — fields look ready to file. Use Submit payment request below so this goes through your wallet policy and audit trail (same as the classic invoice form). I can help with tweaks first if you want.",
      patch,
    };
  }

  const vendorM = lastUser.match(/vendor\s+(?:is|=)\s*["']?([^"'\n]+)/i);
  if (vendorM) patch.vendor = vendorM[1].trim();

  const invM = lastUser.match(/invoice\s*#?\s*(?:is|=)?\s*["']?([A-Za-z0-9\-]+)/i);
  if (invM && invM[1].length <= 40) patch.invoiceNumber = invM[1].trim();

  if (/amount|total|(\$\s*[0-9])/.test(lower)) {
    const amt = parseAmount(lastUser);
    if (amt != null) patch.amount = amt;
  }

  const dueM = lastUser.match(/due\s+(?:date\s+)?(?:is|=)?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-1]?[0-9]\/[0-3]?[0-9]\/[0-9]{2,4})/i);
  if (dueM) patch.dueDate = dueM[1].trim();

  if (Object.keys(patch).length > 0) {
    const parts = Object.entries(patch).map(([k, v]) => `${k}: ${v}`);
    return {
      reply: `Got it — I’ve updated ${parts.join(", ")}. Say submit when you want this filed as a payment request, or keep refining.`,
      patch,
    };
  }

  if (extraction?.vendor || extraction?.amount != null) {
    return {
      reply: `Here’s what I’m holding from the document: vendor ${String(extraction.vendor ?? "—")}, amount ${extraction.amount != null ? String(extraction.amount) : "—"}, invoice # ${String(extraction.invoiceNumber ?? "—")}. Correct me in plain English (e.g. “vendor is Acme LLC”, “amount is 42.50”), or say submit when you’re ready.`,
      patch,
    };
  }

  return {
    reply:
      "Upload an invoice screenshot or PDF page (image) and I’ll read it. After that, we can adjust any field or file the request when you’re happy.",
    patch,
  };
}

async function openaiTurn(
  messages: InvoiceChatMessage[],
  extraction: Record<string, unknown> | null
): Promise<InvoiceChatTurnResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.CUSTOS_INVOICE_CHAT_MODEL?.trim() || "gpt-4o-mini";
  const sys = `You are Custos Invoice Copilot — a concise, friendly agent helping an operator pay vendor invoices.
Current extracted fields (JSON, may be empty): ${extractionSummary(extraction)}
Rules:
- Reply in plain text, short (under 120 words), no markdown headings.
- If the user corrects a field, put the new value in JSON.patch with only changed keys: vendor (string), invoiceNumber (string), amount (number), dueDate (string), memo (string), confidence (number 0-1).
- If they confirm they want to file the payment, tell them to use the Submit payment request button and set patch to {}.
You must respond with valid JSON only: {"reply":"string","patch":{}}`;

  const body = {
    model,
    temperature: 0.4,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: sys },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${t.slice(0, 200)}`);
  }
  const data = (await r.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty OpenAI response");
  let parsed: { reply?: string; patch?: Record<string, unknown> };
  try {
    parsed = JSON.parse(raw) as { reply?: string; patch?: Record<string, unknown> };
  } catch {
    throw new Error("OpenAI returned non-JSON");
  }
  return {
    reply: typeof parsed.reply === "string" ? parsed.reply : "OK.",
    patch: parsed.patch && typeof parsed.patch === "object" ? parsed.patch : {},
  };
}

export async function runInvoiceChatTurn(input: {
  messages: InvoiceChatMessage[];
  extraction: Record<string, unknown> | null;
}): Promise<InvoiceChatTurnResult> {
  try {
    const ai = await openaiTurn(input.messages, input.extraction);
    if (ai) return ai;
  } catch {
    /* fall through to heuristic */
  }
  return heuristicTurn(input.messages, input.extraction);
}
