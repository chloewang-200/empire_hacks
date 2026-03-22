import type { AgentSettings, CompiledAuditPolicy, CompiledAuditRule } from "@/lib/types";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function includesAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function parseConfidenceThreshold(text: string): number | null {
  const direct =
    text.match(/confidence[^0-9]{0,32}(\d{1,3}(?:\.\d+)?)(?:\s*%|\b)/i) ??
    text.match(/(?:below|under|less than|at most|max(?:imum)?)\s*(\d{1,3}(?:\.\d+)?)(?:\s*%|\b)/i);
  if (!direct?.[1]) return null;
  const raw = Number(direct[1]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw > 1) return Math.min(1, raw > 100 ? 1 : raw / 100);
  return Math.min(1, raw);
}

function parseMultiplier(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)x/i);
  if (!match?.[1]) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.min(10, raw);
}

function buildRule(
  id: string,
  label: string,
  enabled: boolean,
  detail: string
): CompiledAuditRule {
  return {
    id,
    label,
    enabled,
    action: "review",
    detail,
  };
}

export function compileAuditPolicyText(text: string | null | undefined): CompiledAuditPolicy {
  const sourceText = normalizeText(text);
  const lower = sourceText.toLowerCase();
  const enabled = sourceText.length > 0;

  const reviewOnDuplicateInvoice = enabled &&
    includesAny(lower, ["duplicate", "same invoice", "repeat invoice", "already paid", "invoice dupe"]);
  const reviewOnUnmatchedVendor = enabled &&
    includesAny(lower, ["unmatched vendor", "new vendor", "unknown vendor", "vendor not matched", "payee"]);
  const reviewOnMissingEvidence = enabled &&
    includesAny(lower, ["evidence", "proof", "attachment", "receipt", "supporting document", "supporting evidence"]);
  const reviewOnMissingCitations = enabled &&
    includesAny(lower, ["citation", "cited", "source", "rule", "policy"]);
  const reviewOnRailMismatch = enabled &&
    includesAny(lower, ["rail mismatch", "payment rail", "payment method", "rail", "venmo", "ach", "wire", "card"]);
  const reviewOnMissingInvoiceNumber = enabled &&
    includesAny(lower, ["invoice number", "invoice #", "invoice no", "inv #"]);
  const reviewOnMissingDueDate = enabled &&
    includesAny(lower, ["due date", "payment due"]);
  const reviewOnAmountAnomaly = enabled &&
    includesAny(lower, ["historical", "history", "historical norm", "usual", "average", "avg", "median", "amount"]);

  const minExtractionConfidence =
    parseConfidenceThreshold(sourceText) ??
    (enabled && (reviewOnDuplicateInvoice || reviewOnUnmatchedVendor || reviewOnMissingEvidence)
      ? 0.85
      : null);

  const amountAnomalyMultiplier = reviewOnAmountAnomaly
    ? parseMultiplier(sourceText) ?? 1.5
    : 1.5;

  const ruleSet = enabled
    ? [
        buildRule(
          "duplicate_invoice",
          "Duplicate invoice detection",
          reviewOnDuplicateInvoice,
          "Compare vendor, invoice number, and amount against recent requests."
        ),
        buildRule(
          "unmatched_vendor",
          "Unmatched vendor review",
          reviewOnUnmatchedVendor,
          "Send to review when the invoice vendor does not match an approved payee."
        ),
        buildRule(
          "low_confidence",
          "Low extraction confidence review",
          minExtractionConfidence != null,
          `Review when extraction confidence drops below ${Math.round((minExtractionConfidence ?? 0) * 100)}%.`
        ),
        buildRule(
          "missing_evidence",
          "Missing evidence review",
          reviewOnMissingEvidence,
          "Require invoice evidence or attachments before approval."
        ),
        buildRule(
          "missing_citations",
          "Missing citation review",
          reviewOnMissingCitations,
          "Require the agent to cite supporting policy or source material."
        ),
        buildRule(
          "rail_mismatch",
          "Rail mismatch review",
          reviewOnRailMismatch,
          "Compare the requested payout rail with the vendor record."
        ),
        buildRule(
          "missing_invoice_number",
          "Missing invoice number review",
          reviewOnMissingInvoiceNumber,
          "Require invoice number / reference field when the policy mentions it."
        ),
        buildRule(
          "missing_due_date",
          "Missing due date review",
          reviewOnMissingDueDate,
          "Require due date when the policy mentions it."
        ),
        buildRule(
          "amount_anomaly",
          "Amount anomaly review",
          reviewOnAmountAnomaly,
          `Escalate when an amount exceeds the recent average by ${amountAnomalyMultiplier}x.`
        ),
      ]
    : [];

  const summary = ruleSet
    .filter((rule) => rule.enabled)
    .map((rule) => rule.label);

  return {
    sourceText,
    enabled,
    minExtractionConfidence,
    reviewOnDuplicateInvoice,
    reviewOnUnmatchedVendor,
    reviewOnRailMismatch,
    reviewOnMissingEvidence,
    reviewOnMissingCitations,
    reviewOnMissingInvoiceNumber,
    reviewOnMissingDueDate,
    reviewOnAmountAnomaly,
    amountAnomalyMultiplier,
    ruleSet,
    summary,
  };
}

export function getAuditPolicyText(settings: AgentSettings | null | undefined): string {
  if (!settings) return "";
  const text = normalizeText(settings.auditPolicyText);
  if (text) return text;
  if (settings.auditPolicy && typeof settings.auditPolicy === "object" && !Array.isArray(settings.auditPolicy)) {
    return normalizeText(settings.auditPolicy.sourceText);
  }
  return "";
}

export function summarizeAuditPolicy(policy: CompiledAuditPolicy): string {
  if (!policy.enabled) return "No verbal audit policy configured";
  if (policy.summary.length === 0) return "Policy configured but no active rules matched";
  return policy.summary.join(", ");
}
