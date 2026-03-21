/**
 * Template invoice agent — sync extract only.
 * POST /extract (multipart field "file") → JSON matching InvoiceExtractionResult + railType hint.
 * custos_be sets CUSTOS_INVOICE_AGENT_URL to this service URL (e.g. http://localhost:4001/extract).
 */
import express from "express";
import multer from "multer";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const app = express();
const port = Number(process.env.PORT ?? 4001);

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

app.post("/extract", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "file required (multipart field 'file')" });
      return;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.json(mockExtract(file.originalname || "upload"));
      return;
    }

    const client = new OpenAI({ apiKey });
    const b64 = file.buffer.toString("base64");
    const mime = file.mimetype || "image/png";

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
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

    const raw = completion.choices[0]?.message?.content ?? "{}";
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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`custos_agents invoice listening on ${port} (POST /extract)`);
});
