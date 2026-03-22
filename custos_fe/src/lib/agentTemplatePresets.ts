import type { UseFormSetValue } from "react-hook-form";
import type { AgentFormValues } from "@/lib/validators/agent";

const EVENT_DESC =
  "Plans vendor payables from event budgets and contracts; each line is submitted as a separate Custos transaction with risk signals.";

const INVOICE_DESC =
  "Extracts fields from invoice uploads and requests payment through wallet policy.";

/** Apply suggested copy and governance defaults when user picks a starter template. */
export function applyStarterTemplateFields(
  templateId: string,
  setValue: UseFormSetValue<AgentFormValues>
): void {
  if (templateId === "event_production") {
    setValue("description", EVENT_DESC);
    setValue("allowedCategories", ["events_production"]);
    return;
  }
  if (templateId === "invoice") {
    setValue("description", INVOICE_DESC);
    setValue("allowedCategories", []);
    return;
  }
  setValue("description", "");
}
