import type { Transaction, PaginatedResponse } from "@/lib/types";
import { apiGet, apiPost, apiPatch } from "./client";

export async function getTransactions(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  walletId?: string;
  agentId?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}): Promise<PaginatedResponse<Transaction>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  if (params?.walletId) search.set("walletId", params.walletId);
  if (params?.agentId) search.set("agentId", params.agentId);
  if (params?.category) search.set("category", params.category);
  if (params?.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params?.dateTo) search.set("dateTo", params.dateTo);
  if (params?.sort) search.set("sort", params.sort);
  const q = search.toString();
  return apiGet<PaginatedResponse<Transaction>>(`/api/transactions${q ? `?${q}` : ""}`);
}

export async function getTransaction(id: string): Promise<Transaction> {
  return apiGet<Transaction>(`/api/transactions/${id}`);
}

export interface RequestTransactionBody {
  agentId: string;
  walletId: string;
  amount: number;
  currency: string;
  recipient?: string;
  vendor?: string;
  category?: string;
  memo?: string;
  /** Why the agent is requesting this spend (audit trail) */
  purpose?: string;
  /** Structured proof-of-work / metadata (invoice #, tool run id, etc.) */
  context?: Record<string, unknown>;
  /** Override directory match — must be an approved payee id */
  payeeId?: string;
  railType?: string;
  sourceKind?: string;
  evidence?: { type: string; [k: string]: unknown }[];
  idempotencyKey?: string;
  riskScore?: number;
  riskFlags?: string[];
  citedRules?: { id: string; title: string; source?: string; excerpt?: string }[];
  agentDecision?: { summary: string; reasoning?: string; modelConfidence?: number };
}

/** Dashboard & invoice UI — user JWT; same payload shape as agent API. */
export async function requestTransaction(body: RequestTransactionBody): Promise<Transaction> {
  return apiPost<Transaction>("/api/transactions/request-as-user", body);
}

export interface ReviewTransactionBody {
  decision: "approve" | "reject";
  note?: string;
}

export async function reviewTransaction(id: string, body: ReviewTransactionBody): Promise<Transaction> {
  return apiPatch<Transaction>(`/api/transactions/${id}/review`, body);
}

export async function updateTransactionStatus(id: string, status: string): Promise<Transaction> {
  return apiPatch<Transaction>(`/api/transactions/${id}/status`, { status });
}
