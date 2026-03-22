import type { UseFormSetValue } from "react-hook-form";
import type { AgentFormValues } from "@/lib/validators/agent";

const EVENT_DESC =
  "Plans vendor payables from event budgets and contracts; each line is submitted as a separate Custos transaction with risk signals.";

const INVOICE_DESC =
  "Extracts invoice fields, proposes payment, and hands the request to an auditor-style control flow.";

/** Apply suggested copy and governance defaults when user picks a starter template. */
export function applyStarterTemplateFields(
  templateId: string,
  setValue: UseFormSetValue<AgentFormValues>
): void {
  if (templateId === "event_production") {
    setValue("description", EVENT_DESC);
    setValue("allowedCategories", ["events_production"]);
    setValue("auditPolicyText", "");
    return;
  }
  if (templateId === "invoice") {
    setValue("description", INVOICE_DESC);
    setValue("allowedCategories", []);
    setValue(
      "auditPolicyText",
      "Flag duplicate invoices by vendor + invoice number + amount. Review unmatched vendors. Escalate confidence below 85%. Require citations and invoice evidence. Review rail mismatch and missing due date."
    );
    return;
  }
  if (templateId === "invoice_chat") {
    setValue(
      "description",
      "Chat-first invoice assistant: operators upload images and negotiate fields in natural language before filing spend."
    );
    setValue("allowedCategories", []);
    setValue(
      "auditPolicyText",
      "Same invoice audit rules as the classic template: duplicates, unmatched vendors, confidence, citations, evidence, rail and due date checks."
    );
    return;
  }
  setValue("description", "");
  setValue("auditPolicyText", "");
}
