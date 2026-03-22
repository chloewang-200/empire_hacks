import type { CompiledAuditPolicy, CompiledAuditRule, PolicyEvaluationItem } from "./types.js";

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

  const minExtractionConfidence = reviewOnDuplicateInvoice || reviewOnUnmatchedVendor || reviewOnMissingEvidence
    ? parseConfidenceThreshold(sourceText) ?? 0.85
    : parseConfidenceThreshold(sourceText);

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

export function getAuditPolicyText(settings: Record<string, unknown> | null | undefined): string {
  if (!settings) return "";
  const text = normalizeText(settings.auditPolicyText);
  if (text) return text;
  const compiled = settings.auditPolicy;
  if (compiled && typeof compiled === "object" && !Array.isArray(compiled)) {
    return normalizeText((compiled as Record<string, unknown>).sourceText);
  }
  return "";
}

export function normalizeAgentSettings(
  settings: Record<string, unknown> | null | undefined,
  existingSettings?: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const merged = {
    ...(existingSettings ?? {}),
    ...(settings ?? {}),
  } as Record<string, unknown>;
  const auditPolicyText = getAuditPolicyText(merged);
  const auditPolicy = compileAuditPolicyText(auditPolicyText);
  return {
    ...merged,
    auditPolicyText,
    auditPolicy,
  };
}

export type InvoiceAuditInput = {
  auditPolicy: CompiledAuditPolicy;
  vendor?: string;
  amountCents: number;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  extractionConfidence?: number | null;
  requestedPayoutRail?: string | null;
  matchedPayeeName?: string | null;
  matchedPayeeRail?: string | null;
  hasEvidence: boolean;
  citedRulesCount: number;
  recentInvoices: Array<{
    vendor?: string | null;
    amountCents: number;
    invoiceNumber?: string | null;
  }>;
};

export function evaluateInvoiceAudit(input: InvoiceAuditInput): {
  checks: PolicyEvaluationItem[];
  reviewRequired: boolean;
} {
  const checks: PolicyEvaluationItem[] = [];
  const policy = input.auditPolicy;
  const activeRules = policy.ruleSet.filter((rule) => rule.enabled);

  checks.push({
    check: "Invoice audit policy",
    result: policy.enabled ? "pass" : "pass",
    detail: policy.enabled
      ? activeRules.length
        ? `Active rules: ${activeRules.map((rule) => rule.label).join(", ")}`
        : "Policy configured but no active rules matched"
      : "No verbal audit policy configured",
  });

  let reviewRequired = false;
  const vendor = input.vendor?.trim().toLowerCase() ?? "";
  const invoiceNumber = input.invoiceNumber?.trim().toLowerCase() ?? "";
  const requestedRail = input.requestedPayoutRail?.trim().toLowerCase() ?? "";
  const matchedRail = input.matchedPayeeRail?.trim().toLowerCase() ?? "";

  const passOrFail = (check: string, failed: boolean, detail: string) => {
    checks.push({ check, result: failed ? "fail" : "pass", detail });
    if (failed) reviewRequired = true;
  };

  if (!policy.enabled) {
    return { checks, reviewRequired };
  }

  if (policy.reviewOnUnmatchedVendor) {
    passOrFail(
      "Approved payee / vendor",
      !input.matchedPayeeName,
      input.matchedPayeeName
        ? `Matched to approved payee "${input.matchedPayeeName}"`
        : "Vendor did not match an approved payee"
    );
  }

  if (policy.reviewOnMissingEvidence) {
    passOrFail(
      "Supporting evidence",
      !input.hasEvidence,
      input.hasEvidence ? "Evidence supplied" : "Invoice evidence / attachments required"
    );
  }

  if (policy.reviewOnMissingCitations) {
    passOrFail(
      "Citations / sources",
      input.citedRulesCount === 0,
      input.citedRulesCount > 0
        ? `Agent supplied ${input.citedRulesCount} citation(s)`
        : "Agent did not cite supporting policy or source material"
    );
  }

  if (policy.reviewOnMissingInvoiceNumber) {
    passOrFail(
      "Invoice number",
      invoiceNumber.length === 0,
      invoiceNumber.length > 0 ? `Invoice number ${input.invoiceNumber}` : "Invoice number missing"
    );
  }

  if (policy.reviewOnMissingDueDate) {
    passOrFail(
      "Due date",
      !input.dueDate?.trim(),
      input.dueDate?.trim() ? `Due date ${input.dueDate}` : "Due date missing"
    );
  }

  if (policy.minExtractionConfidence != null) {
    const conf = input.extractionConfidence;
    const failed = conf != null && conf < policy.minExtractionConfidence;
    passOrFail(
      "Extraction confidence",
      failed,
      conf == null
        ? `No extraction confidence supplied; expected at least ${Math.round(policy.minExtractionConfidence * 100)}%`
        : `Confidence ${Math.round(conf * 100)}% compared with threshold ${Math.round(policy.minExtractionConfidence * 100)}%`
    );
  }

  if (policy.reviewOnRailMismatch && requestedRail) {
    const failed = Boolean(matchedRail) && requestedRail !== matchedRail;
    passOrFail(
      "Payout rail match",
      failed,
      matchedRail
        ? `Requested rail "${input.requestedPayoutRail}" differs from vendor default "${input.matchedPayeeRail}"`
        : "No vendor rail recorded for comparison"
    );
  }

  if (policy.reviewOnDuplicateInvoice) {
    const duplicate = input.recentInvoices.find((previous) => {
      const prevVendor = previous.vendor?.trim().toLowerCase() ?? "";
      const prevInvoiceNumber = previous.invoiceNumber?.trim().toLowerCase() ?? "";
      const sameVendor = vendor && prevVendor && vendor === prevVendor;
      const sameAmount = previous.amountCents === input.amountCents;
      const hasInvoiceNumber = invoiceNumber.length > 0 && prevInvoiceNumber.length > 0;
      if (hasInvoiceNumber) {
        return sameVendor && sameAmount && invoiceNumber === prevInvoiceNumber;
      }
      return sameVendor && sameAmount;
    });
    passOrFail(
      "Duplicate invoice",
      Boolean(duplicate),
      duplicate
        ? `Matched recent invoice (vendor ${duplicate.vendor ?? "unknown"}, amount ${(duplicate.amountCents / 100).toFixed(2)})`
        : "No matching recent invoice"
    );
  }

  if (policy.reviewOnAmountAnomaly) {
    const comparable = input.recentInvoices.filter((previous) => {
      const prevVendor = previous.vendor?.trim().toLowerCase() ?? "";
      return vendor ? prevVendor === vendor : true;
    });
    if (comparable.length > 0) {
      const average =
        comparable.reduce((sum, row) => sum + row.amountCents, 0) / comparable.length;
      const failed = input.amountCents > average * policy.amountAnomalyMultiplier;
      passOrFail(
        "Amount anomaly",
        failed,
        failed
          ? `Amount ${(input.amountCents / 100).toFixed(2)} exceeds recent average ${(average / 100).toFixed(2)} by ${policy.amountAnomalyMultiplier}x`
          : `Compared against ${comparable.length} recent invoice(s)`
      );
    } else {
      checks.push({
        check: "Amount anomaly",
        result: "pass",
        detail: "No comparable invoices available",
      });
    }
  }

  return { checks, reviewRequired };
}
