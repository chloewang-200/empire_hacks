/**
 * Template invoice agent — sync extract only.
 * POST /extract (multipart field "file") → JSON matching InvoiceExtractionResult + railType hint.
 * custos_be sets CUSTOS_INVOICE_AGENT_URL to this service URL (e.g. http://localhost:4001/extract).
 */
import express from "express";
import multer from "multer";
import OpenAI from "openai";
import { loadLocalEnv } from "./env.js";
import { registerPlayground } from "./playground.js";

loadLocalEnv();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const app = express();
const port = Number(process.env.PORT ?? 4001);
const anthropicModel = process.env.ANTHROPIC_MODEL ?? process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
const openAiModel = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
const playgroundEnabled = process.env.ENABLE_LOCAL_PLAYGROUND === "true";

function inferRailFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("venmo") || /@venmo|venmo\.com/i.test(text)) return "venmo_p2p";
  if (t.includes("ach") || t.includes("routing") || t.includes("account number"))
    return "ach";
  if (t.includes("wire") || t.includes("swift")) return "wire";
  if (t.includes("paypal")) return "paypal";
  return "merchant_card";
}

function mockExtract(filename: string) {
  return {
    vendor: "Mock Vendor LLC",
    invoiceNumber: `INV-${filename.slice(0, 8)}`,
    amount: 1250,
    dueDate: new Date().toISOString().slice(0, 10),
    memo: "Mock extraction (set OPENAI_API_KEY for vision)",
    confidence: 0.4,
    sourceFileId: filename,
    railType: "merchant_card",
  };
}

function getClaudeApiKey() {
  return process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY;
}

function isPdf(mime: string) {
  return mime === "application/pdf";
}

function isImage(mime: string) {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
}

function buildClaudeContent(file: Express.Multer.File) {
  const mime = file.mimetype || "image/png";
  const data = file.buffer.toString("base64");

  if (isPdf(mime)) {
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data,
        },
      },
      {
        type: "text",
        text:
          "Extract invoice fields as JSON only, no markdown. Keys: vendor (string), invoiceNumber (string), amount (number USD), dueDate (YYYY-MM-DD or empty), memo (string), paymentHints (short string describing how to pay).",
      },
    ];
  }

  if (isImage(mime)) {
    return [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mime,
          data,
        },
      },
      {
        type: "text",
        text:
          "Extract invoice fields as JSON only, no markdown. Keys: vendor (string), invoiceNumber (string), amount (number USD), dueDate (YYYY-MM-DD or empty), memo (string), paymentHints (short string describing how to pay).",
      },
    ];
  }

  throw new Error(`Unsupported file type for Claude extraction: ${mime}`);
}

async function extractWithClaude(file: Express.Multer.File) {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: buildClaudeContent(file),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude extraction failed: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const raw =
    payload.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n") ?? "{}";

  return raw;
}

async function extractWithOpenAI(file: Express.Multer.File) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });
  const b64 = file.buffer.toString("base64");
  const mime = file.mimetype || "image/png";

  const completion = await client.chat.completions.create({
    model: openAiModel,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract invoice fields as JSON only, no markdown. Keys: vendor (string), invoiceNumber (string), amount (number USD), dueDate (YYYY-MM-DD or empty), memo (string), paymentHints (short string describing how to pay).",
          },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${b64}` },
          },
        ],
      },
    ],
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content ?? "{}";
}

app.post("/extract", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "file required (multipart field 'file')" });
      return;
    }
    const hasClaude = Boolean(getClaudeApiKey());
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
    if (!hasClaude && !hasOpenAI) {
      res.json(mockExtract(file.originalname || "upload"));
      return;
    }
    const raw = (await extractWithClaude(file)) ?? (await extractWithOpenAI(file)) ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim()) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const vendor = String(parsed.vendor ?? "Unknown vendor");
    const amount = typeof parsed.amount === "number" ? parsed.amount : Number(parsed.amount) || 0;
    const paymentHints = String(parsed.paymentHints ?? parsed.memo ?? "");
    const railType = inferRailFromText(`${vendor} ${paymentHints}`);

    res.json({
      vendor,
      invoiceNumber: String(parsed.invoiceNumber ?? ""),
      amount,
      dueDate: typeof parsed.dueDate === "string" ? parsed.dueDate : undefined,
      memo: String(parsed.memo ?? ""),
      confidence: 0.85,
      sourceFileId: file.originalname,
      railType,
      rawFields: parsed,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e instanceof Error ? e.message : "extract failed" });
  }
});

if (playgroundEnabled) registerPlayground(app);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(
    `custos_agents invoice listening on ${port} (POST /extract${playgroundEnabled ? ", GET /" : ""})`
  );
});
