import type { Agent, PaginatedResponse } from "@/lib/types";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { ApiKeyResponse } from "@/lib/types";

export async function getAgents(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  walletId?: string;
  type?: string;
}): Promise<PaginatedResponse<Agent>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  if (params?.walletId) search.set("walletId", params.walletId);
  if (params?.type) search.set("type", params.type);
  const q = search.toString();
  // TODO: wire to real GET /api/agents when backend exists
  return apiGet<PaginatedResponse<Agent>>(`/api/agents${q ? `?${q}` : ""}`);
}

export async function getAgent(id: string): Promise<Agent> {
  return apiGet<Agent>(`/api/agents/${id}`);
}

export interface CreateAgentBody {
  name: string;
  description?: string;
  templateType: string;
  assignedWalletId: string;
  role: string;
  capabilities: string[];
  status?: string;
}

export async function createAgent(body: CreateAgentBody): Promise<Agent> {
  return apiPost<Agent>("/api/agents", body);
}

export async function updateAgent(id: string, body: Partial<CreateAgentBody>): Promise<Agent> {
  return apiPatch<Agent>(`/api/agents/${id}`, body);
}

export async function deleteAgent(id: string): Promise<void> {
  await apiDelete(`/api/agents/${id}`);
}

/**
 * Same-origin `/api/agents/.../api-key` proxies to custos_be (avoids CORS and works with one API URL).
 */
export async function rotateAgentApiKey(id: string): Promise<ApiKeyResponse> {
  const token =
    typeof window !== "undefined" ? sessionStorage.getItem("custos_jwt") : null;
  const res = await fetch(`/api/agents/${id}/api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: "{}",
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<ApiKeyResponse>;
}

export async function getAgentTransactions(agentId: string, params?: { page?: number }): Promise<PaginatedResponse<import("@/lib/types").Transaction>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  const q = search.toString();
  return apiGet(`/api/agents/${agentId}/transactions${q ? `?${q}` : ""}`);
}
