import type { AgentTemplate } from "@/lib/types";
import { apiGet } from "./client";

export async function getTemplates(): Promise<AgentTemplate[]> {
  const res = await apiGet<AgentTemplate[] | { data: AgentTemplate[] }>("/api/templates");
  return Array.isArray(res) ? res : res.data;
}

export async function getInvoiceTemplate(): Promise<AgentTemplate & { workflowSteps?: string[] }> {
  return apiGet("/api/templates/invoice");
}
