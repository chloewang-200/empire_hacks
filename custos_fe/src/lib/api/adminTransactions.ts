import type { Transaction, PaginatedResponse } from "@/lib/types";
import { apiGet } from "./client";

export async function getAdminTransactions(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  walletId?: string;
  agentId?: string;
}): Promise<PaginatedResponse<Transaction>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  if (params?.walletId) search.set("walletId", params.walletId);
  if (params?.agentId) search.set("agentId", params.agentId);
  const q = search.toString();
  return apiGet<PaginatedResponse<Transaction>>(`/api/admin/transactions${q ? `?${q}` : ""}`);
}
