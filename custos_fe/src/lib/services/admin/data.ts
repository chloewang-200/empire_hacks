import { agentService } from "../agents";
import { transactionService } from "../transactions";
import { userService } from "../users";
import { vendorService } from "../vendors";
import type { Agent, Transaction } from "../types";
import type {
  AdminAgent,
  AdminTransaction,
  ApprovalDecisionResult,
  CompanySummary,
} from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getManualReviewStatus(transaction: Transaction) {
  return (transaction.metadata.manualReviewStatus as
    | "pending"
    | "verified"
    | "rejected"
    | undefined) ?? "pending";
}

function toAdminAgent(agent: Agent): AdminAgent {
  return {
    ...agent,
    riskLevel: (agent.metadata.riskLevel as string | null | undefined) ?? null,
    lastActiveAt: (agent.metadata.lastActiveAt as string | null | undefined) ?? null,
  };
}

function toAdminTransaction(transaction: Transaction): AdminTransaction {
  return {
    ...transaction,
    auditTrail: transaction.auditTrail ?? [],
    manualReviewStatus: getManualReviewStatus(transaction),
    manuallyVerifiedByUserId:
      (transaction.metadata.manuallyVerifiedByUserId as string | null | undefined) ?? null,
    manuallyVerifiedAt:
      (transaction.metadata.manuallyVerifiedAt as string | null | undefined) ?? null,
    isHumanApproved:
      transaction.humanApprovalReceived ||
      transaction.approvalStatus === "human_approved",
    isMade: transaction.paymentStatus === "paid",
  };
}

function toApprovalResult(transaction: Transaction, reason?: string): ApprovalDecisionResult {
  return {
    transaction: toAdminTransaction(transaction),
    reason,
  };
}

export async function listCompanies(): Promise<CompanySummary[]> {
  const currentUser = await userService.getCurrentUser();
  const usersResult = await userService.listUsers({
    clientId: currentUser.clientId,
    limit: 100,
  });

  const owners = usersResult.items.filter((user) => user.role === "owner" || user.role === "finance");
  const companyIds = Array.from(
    new Set([
      ...owners.map((user) => user.clientId),
      currentUser.clientId,
      "client_orbit",
      "client_summit",
    ])
  );

  const companies = await Promise.all(
    companyIds.map(async (clientId) => {
      const agentsResult = await agentService.listAgents({ clientId, limit: 100 });
      const transactionsResult = await transactionService.listTransactions({
        clientId,
        limit: 100,
      });
      const companyOwner =
        owners.find((user) => user.clientId === clientId) ??
        (await userService.listUsers({ clientId, limit: 1 })).items[0];

      return {
        clientId,
        companyName:
          (companyOwner?.metadata.companyName as string | undefined) ?? clientId,
        companyStatus:
          ((companyOwner?.metadata.companyStatus as
            | "active"
            | "inactive"
            | "under_review"
            | undefined) ?? "active"),
        defaultCurrency: companyOwner?.defaultCurrency ?? "USD",
        agentCount: agentsResult.items.length,
        transactionCount: transactionsResult.items.length,
        pendingApprovalCount: transactionsResult.items.filter(
          (transaction) => transaction.approvalStatus === "pending_human_approval"
        ).length,
        paidVolume: transactionsResult.items
          .filter((transaction) => transaction.paymentStatus === "paid")
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        lastTransactionAt:
          transactionsResult.items
            .map((transaction) => transaction.updatedAt)
            .sort()
            .at(-1) ?? null,
      } satisfies CompanySummary;
    })
  );

  return clone(companies);
}

export async function getCompany(clientId: string): Promise<CompanySummary> {
  const companies = await listCompanies();
  const company = companies.find((item) => item.clientId === clientId);
  if (!company) throw new Error("Company not found");
  return clone(company);
}

export async function listAgentsByCompany(clientId: string): Promise<AdminAgent[]> {
  const result = await agentService.listAgents({ clientId, limit: 100 });
  return result.items.map(toAdminAgent);
}

export async function getAgent(agentId: string): Promise<AdminAgent> {
  const agent = await agentService.getAgent(agentId);
  return toAdminAgent(agent);
}

export async function listTransactionsByAgent(agentId: string): Promise<AdminTransaction[]> {
  const agent = await agentService.getAgent(agentId);
  const result = await transactionService.listTransactions({
    clientId: agent.clientId,
    agentId,
    limit: 100,
  });
  return result.items.map(toAdminTransaction);
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
  const transaction = await transactionService.getTransaction(transactionId);
  return toAdminTransaction(transaction);
}

export async function approveTransaction(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  const currentUser = await userService.getCurrentUser();
  const result = await transactionService.approveTransaction({
    transactionId,
    approvedByUserId: currentUser.userId,
    reason,
  });
  return toApprovalResult(result.transaction, reason);
}

export async function unapproveTransaction(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  const transaction = await transactionService.unapproveTransaction(transactionId);
  return toApprovalResult(transaction, reason);
}

export async function verifyTransactionRules(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  const transaction = await transactionService.getTransaction(transactionId);
  transaction.metadata.manualReviewStatus = "verified";
  transaction.metadata.manuallyVerifiedByUserId = "user_admin";
  transaction.metadata.manuallyVerifiedAt = new Date().toISOString();
  const updated = await transactionService.updateTransaction(transactionId, {
    metadata: transaction.metadata,
  });
  return toApprovalResult(updated, reason);
}

export async function rejectTransaction(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  const currentUser = await userService.getCurrentUser();
  const result = await transactionService.rejectTransaction({
    transactionId,
    approvedByUserId: currentUser.userId,
    reason,
  });
  return toApprovalResult(result.transaction, reason);
}

export async function markTransactionDone(
  transactionId: string,
  reason?: string
): Promise<ApprovalDecisionResult> {
  const transaction = await transactionService.markDone(transactionId);
  return toApprovalResult(transaction, reason);
}
