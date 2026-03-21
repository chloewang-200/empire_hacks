import type { AgentTemplate } from "@/lib/types";
import { apiGet } from "./client";

export async function getTemplates(): Promise<AgentTemplate[]> {
  return apiGet<AgentTemplate[]>("/api/templates");
}

export async function getInvoiceTemplate(): Promise<AgentTemplate & { workflowSteps?: string[] }> {
  return apiGet("/api/templates/invoice");
}
