import { mockApprovalDecisions, mockTransactions } from "./mockData";
import type {
  ApprovalDecision,
  PaginatedList,
  Transaction,
  TransactionAuditEvent,
} from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let transactions = clone(mockTransactions);
let approvalDecisions = clone(mockApprovalDecisions);

function getTransactionRecord(transactionId: string) {
  const transaction = transactions.find((item) => item.transactionId === transactionId);
  if (!transaction) throw new Error("Transaction not found");
  if (!transaction.auditTrail) transaction.auditTrail = [];
  return transaction;
}

function appendAuditEvent(transaction: Transaction, event: TransactionAuditEvent) {
  if (!transaction.auditTrail) transaction.auditTrail = [];
  transaction.auditTrail.push(event);
}

export const transactionService = {
  async createTransaction(
    input: Omit<
      Transaction,
      | "transactionId"
      | "vendorNameSnapshot"
      | "paymentStatus"
      | "approvalStatus"
      | "ruleEvaluationResult"
      | "humanApprovalRequired"
      | "humanApprovalReceived"
      | "humanApprovedByUserId"
      | "humanApprovedAt"
      | "paidAt"
      | "externalPaymentId"
      | "encryptedPaymentRefId"
      | "failureReason"
      | "createdAt"
      | "updatedAt"
      | "auditTrail"
    >
  ): Promise<Transaction> {
    await wait();
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...input,
      transactionId: `txn_${Date.now()}`,
      vendorNameSnapshot: input.vendorId,
      paymentStatus: "pending",
      approvalStatus: "pending_human_approval",
      ruleEvaluationResult: "needs_review",
      humanApprovalRequired: true,
      humanApprovalReceived: false,
      humanApprovedByUserId: null,
      humanApprovedAt: null,
      paidAt: null,
      externalPaymentId: null,
      encryptedPaymentRefId: null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
      auditTrail: [
        {
          eventId: `evt_${Date.now()}`,
          eventType: "created",
          eventTimestamp: now,
          actorType: input.agentId ? "agent" : "user",
          actorId: input.agentId ?? input.requestedByUserId ?? null,
          details: {},
        },
      ],
    };
    transactions.push(transaction);
    return clone(transaction);
  },

  async listTransactions(filters: {
    clientId: string;
    vendorId?: string;
    agentId?: string;
    paymentStatus?: string;
    approvalStatus?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    cursor?: string;
  }): Promise<PaginatedList<Transaction>> {
    await wait();
    let items = transactions.filter((tx) => tx.clientId === filters.clientId);
    if (filters.vendorId) items = items.filter((tx) => tx.vendorId === filters.vendorId);
    if (filters.agentId) items = items.filter((tx) => tx.agentId === filters.agentId);
    if (filters.paymentStatus) items = items.filter((tx) => tx.paymentStatus === filters.paymentStatus);
    if (filters.approvalStatus) items = items.filter((tx) => tx.approvalStatus === filters.approvalStatus);
    if (filters.fromDate) items = items.filter((tx) => tx.createdAt >= filters.fromDate!);
    if (filters.toDate) items = items.filter((tx) => tx.createdAt <= filters.toDate!);
    return {
      items: clone(items.slice(0, filters.limit ?? items.length)),
      nextCursor: null,
    };
  },

  async getTransaction(transactionId: string): Promise<Transaction> {
    await wait();
    return clone(getTransactionRecord(transactionId));
  },

  async updateTransaction(
    transactionId: string,
    patch: Partial<Pick<Transaction, "paymentMethod" | "requestedPaymentDatetime" | "invoiceFilePath" | "description" | "metadata">>
  ): Promise<Transaction> {
    await wait();
    const transaction = getTransactionRecord(transactionId);
    Object.assign(transaction, patch, { updatedAt: new Date().toISOString() });
    return clone(transaction);
  },

  async deleteTransaction(transactionId: string): Promise<{ success: boolean }> {
    await wait();
    transactions = transactions.filter((tx) => tx.transactionId !== transactionId);
    return { success: true };
  },

  async cancelTransaction(transactionId: string, reason?: string): Promise<Transaction> {
    await wait();
    const transaction = getTransactionRecord(transactionId);
    transaction.paymentStatus = "cancelled";
    transaction.failureReason = reason ?? "Cancelled";
    transaction.updatedAt = new Date().toISOString();
    appendAuditEvent(transaction, {
      eventId: `evt_${transactionId}_${Date.now()}`,
      eventType: "cancelled",
      eventTimestamp: transaction.updatedAt,
      actorType: "user",
      actorId: "user_admin",
      details: reason ? { reason } : {},
    });
    return clone(transaction);
  },

  async approveTransaction(input: {
    transactionId: string;
    approvedByUserId: string;
    reason?: string;
  }): Promise<{ transaction: Transaction; approvalDecision: ApprovalDecision }> {
    await wait();
    const transaction = getTransactionRecord(input.transactionId);
    transaction.approvalStatus = "human_approved";
    transaction.humanApprovalRequired = true;
    transaction.humanApprovalReceived = true;
    transaction.humanApprovedByUserId = input.approvedByUserId;
    transaction.humanApprovedAt = new Date().toISOString();
    transaction.paymentStatus =
      transaction.paymentStatus === "pending" ? "scheduled" : transaction.paymentStatus;
    transaction.updatedAt = new Date().toISOString();
    appendAuditEvent(transaction, {
      eventId: `evt_${input.transactionId}_${Date.now()}`,
      eventType: "approved",
      eventTimestamp: transaction.updatedAt,
      actorType: "user",
      actorId: input.approvedByUserId,
      details: input.reason ? { reason: input.reason } : {},
    });
    const approvalDecision: ApprovalDecision = {
      approvalDecisionId: `apd_${Date.now()}`,
      transactionId: input.transactionId,
      approvedByUserId: input.approvedByUserId,
      decision: "approved",
      reason: input.reason ?? null,
      createdAt: transaction.updatedAt,
    };
    approvalDecisions.push(approvalDecision);
    return { transaction: clone(transaction), approvalDecision: clone(approvalDecision) };
  },

  async rejectTransaction(input: {
    transactionId: string;
    approvedByUserId: string;
    reason?: string;
  }): Promise<{ transaction: Transaction; approvalDecision: ApprovalDecision }> {
    await wait();
    const transaction = getTransactionRecord(input.transactionId);
    transaction.approvalStatus = "rejected";
    transaction.paymentStatus = "cancelled";
    transaction.humanApprovalRequired = true;
    transaction.humanApprovalReceived = false;
    transaction.failureReason = input.reason ?? "Rejected";
    transaction.updatedAt = new Date().toISOString();
    appendAuditEvent(transaction, {
      eventId: `evt_${input.transactionId}_${Date.now()}`,
      eventType: "rejected",
      eventTimestamp: transaction.updatedAt,
      actorType: "user",
      actorId: input.approvedByUserId,
      details: input.reason ? { reason: input.reason } : {},
    });
    const approvalDecision: ApprovalDecision = {
      approvalDecisionId: `apd_${Date.now()}`,
      transactionId: input.transactionId,
      approvedByUserId: input.approvedByUserId,
      decision: "rejected",
      reason: input.reason ?? null,
      createdAt: transaction.updatedAt,
    };
    approvalDecisions.push(approvalDecision);
    return { transaction: clone(transaction), approvalDecision: clone(approvalDecision) };
  },

  async unapproveTransaction(transactionId: string): Promise<Transaction> {
    await wait();
    const transaction = getTransactionRecord(transactionId);
    transaction.approvalStatus = "pending_human_approval";
    transaction.humanApprovalReceived = false;
    transaction.humanApprovedByUserId = null;
    transaction.humanApprovedAt = null;
    if (transaction.paymentStatus === "scheduled" || transaction.paymentStatus === "processing") {
      transaction.paymentStatus = "pending";
    }
    transaction.updatedAt = new Date().toISOString();
    appendAuditEvent(transaction, {
      eventId: `evt_${transactionId}_${Date.now()}`,
      eventType: "approval_reverted",
      eventTimestamp: transaction.updatedAt,
      actorType: "user",
      actorId: "user_admin",
      details: {},
    });
    return clone(transaction);
  },

  async markDone(transactionId: string): Promise<Transaction> {
    await wait();
    const transaction = getTransactionRecord(transactionId);
    transaction.paymentStatus = "paid";
    transaction.paidAt = new Date().toISOString();
    transaction.updatedAt = transaction.paidAt;
    appendAuditEvent(transaction, {
      eventId: `evt_${transactionId}_${Date.now()}`,
      eventType: "paid",
      eventTimestamp: transaction.updatedAt,
      actorType: "user",
      actorId: "user_admin",
      details: { manuallyMarkedDone: true },
    });
    return clone(transaction);
  },

  async getTransactionAuditTrail(
    transactionId: string
  ): Promise<{ items: TransactionAuditEvent[] }> {
    await wait();
    const transaction = getTransactionRecord(transactionId);
    return { items: clone(transaction.auditTrail ?? []) };
  },
};
