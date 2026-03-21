import type {
  AdminAgent,
  AdminClientSummary,
  AdminTransaction,
  ApprovalDecisionResult,
} from "./types";

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText })) as { message?: string };
    throw new Error(error.message ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

async function patchAdminTransaction(
  transactionId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<ApprovalDecisionResult> {
  const transaction = await adminFetch<AdminTransaction>(
    `/api/admin/transactions/${transactionId}/${action}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  return { transaction, reason: payload.note as string | undefined };
}

export async function listAdminClients(): Promise<AdminClientSummary[]> {
  return adminFetch<AdminClientSummary[]>("/api/admin/clients");
}

export async function getAdminClient(clientId: string): Promise<AdminClientSummary> {
  return adminFetch<AdminClientSummary>(`/api/admin/clients/${clientId}`);
}

export const listAdminUsers = listAdminClients;
export const getAdminUser = getAdminClient;
export const listCompanies = listAdminClients;
export const getCompany = getAdminClient;

export async function listAgentsByCompany(clientId: string): Promise<AdminAgent[]> {
  return adminFetch<AdminAgent[]>(`/api/admin/clients/${clientId}/agents`);
}

export async function getAgent(agentId: string): Promise<AdminAgent> {
  return adminFetch<AdminAgent>(`/api/admin/agents/${agentId}`);
}

export async function listTransactionsByAgent(agentId: string): Promise<AdminTransaction[]> {
  return adminFetch<AdminTransaction[]>(`/api/admin/agents/${agentId}/transactions`);
}

export async function listPendingTransactionsByAgent(
  agentId: string
): Promise<AdminTransaction[]> {
  const transactions = await listTransactionsByAgent(agentId);
  return transactions.filter(
    (transaction) => !transaction.isMade && transaction.paymentStatus !== "cancelled"
  );
}

export async function getTransaction(transactionId: string): Promise<AdminTransaction> {
  return adminFetch<AdminTransaction>(`/api/admin/transactions/${transactionId}`);
}

export async function approveTransaction(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  return patchAdminTransaction(transactionId, "review", {
    decision: "approve",
    note: reason,
  });
}

export async function unapproveTransaction(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  return patchAdminTransaction(transactionId, "reset-review", {
    note: reason,
  });
}

export async function verifyTransactionRules(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  return patchAdminTransaction(transactionId, "verify", {
    note: reason,
  });
}

export async function rejectTransaction(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  return patchAdminTransaction(transactionId, "review", {
    decision: "reject",
    note: reason,
  });
}

export async function markTransactionDone(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  return patchAdminTransaction(transactionId, "settle", {
    note: reason,
  });
}
