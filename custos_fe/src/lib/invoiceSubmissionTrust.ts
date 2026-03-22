import type { InvoiceExtractionResult } from "@/lib/types";
import type { RequestTransactionBody } from "@/lib/api/transactions";

type TrustSlice = Pick<RequestTransactionBody, "citedRules" | "agentDecision">;

/**
 * Default citations + decision trace for invoice-template submissions so the trust / audit panel
 * is populated without a separate LLM call.
 */
export function buildInvoiceTrustFields(opts: {
  extraction: InvoiceExtractionResult;
  purpose: string;
  fileId: string | null;
  originalFilename: string | undefined;
  payeeOverrideId: string;
  agentName?: string;
  /** Invoice Copilot (chat) vs classic upload form */
  viaChat?: boolean;
}): TrustSlice {
  const {
    extraction,
    purpose,
    fileId,
    originalFilename,
    payeeOverrideId,
    agentName,
    viaChat,
  } = opts;

  const vendor = extraction.vendor?.trim() || "Unknown vendor";
  const inv = extraction.invoiceNumber?.trim() || "—";
  const amt = extraction.amount;
  const conf =
    extraction.confidence != null ? Math.round(extraction.confidence * 100) : null;

  const citedRules: NonNullable<RequestTransactionBody["citedRules"]> = [
    viaChat
      ? {
          id: "invoice-chat-channel",
          title: "Invoice Copilot (chat) workflow",
          source: "Product: Invoice chat template",
          excerpt:
            "Operator converses with the Invoice Copilot: upload image → extraction → natural-language corrections → submit. Same policy and audit trail as the classic invoice form, with a more agentic UX.",
        }
      : {
          id: "invoice-template-channel",
          title: "Invoice agent workflow (Custos)",
          source: "Product: Invoice template",
          excerpt:
            "Spend was initiated from the Invoice template: file upload → field extraction → operator review of extracted data → submit to this wallet’s policy. Intended for paying documented vendor invoices, not discretionary spend.",
        },
    {
      id: "invoice-document-evidence",
      title: "Primary evidence: invoice document",
      source: "Uploaded artifact + extraction",
      excerpt: [
        originalFilename ? `File: ${originalFilename}.` : null,
        fileId ? `Stored fileId: ${fileId}.` : null,
        `Extracted vendor "${vendor}", invoice # ${inv}, amount ${amt ?? "—"}.`,
        conf != null ? `Model/OCR confidence ${conf}%.` : null,
      ]
        .filter(Boolean)
        .join(" "),
    },
    {
      id: "operator-purpose-line",
      title: "Business purpose (operator)",
      source: "Dashboard submit step",
      excerpt: purpose.trim()
        ? purpose.trim()
        : "Operator submitted without a custom purpose line; default purpose from extraction context applies.",
    },
    {
      id: "payee-resolution-rule",
      title: "Payee directory resolution",
      source: "Custos payee matching",
      excerpt: payeeOverrideId
        ? "Operator selected an approved payee override; payout rail should follow that payee record when policy allows."
        : "Vendor string is matched against the approved payee directory when required by wallet/agent policy; otherwise vendor is advisory only.",
    },
  ];

  const confidenceSentence =
    conf == null
      ? null
      : conf >= 70
        ? `Extraction confidence ${conf}% — typical threshold for routine review.`
        : `Extraction confidence ${conf}% — lower confidence; human should verify line items and totals against the source document.`;

  const agentDecision: NonNullable<RequestTransactionBody["agentDecision"]> = {
    summary: `Pay vendor invoice: ${vendor} — ${inv} (${typeof amt === "number" ? `$${amt}` : "amount unknown"})`,
    reasoning: [
      viaChat
        ? agentName
          ? `Submitted via Invoice Copilot (chat) bound to agent "${agentName}".`
          : "Submitted via Invoice Copilot (chat template)."
        : agentName
          ? `Submitted via invoice agent "${agentName}".`
          : "Submitted via invoice template.",
      confidenceSentence,
      extraction.memo?.trim()
        ? (() => {
            const m = extraction.memo!.trim();
            return `Extracted memo/context: ${m.slice(0, 280)}${m.length > 280 ? "…" : ""}`;
          })()
        : null,
      extraction.dueDate?.trim() ? `Due date on document: ${extraction.dueDate}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    modelConfidence:
      extraction.confidence != null
        ? Math.min(1, Math.max(0, extraction.confidence))
        : undefined,
  };

  return { citedRules, agentDecision };
}
