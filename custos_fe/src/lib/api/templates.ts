import type { AgentTemplate } from "@/lib/types";
import { apiGet } from "./client";

export async function getTemplates(): Promise<AgentTemplate[]> {
  const res = await apiGet<{ data: AgentTemplate[] }>("/api/templates");
  return res.data;
}

export async function getInvoiceTemplate(): Promise<AgentTemplate & { workflowSteps?: string[] }> {
  return apiGet("/api/templates/invoice");
}
