export type AdminClientStatus = "active" | "inactive" | "under_review";
export type AgentStatus =
  | "active"
  | "paused"
  | "revoked"
  | "deleted"
  | "disabled"
  | "needs_setup";
export type ApprovalStatus =
  | "auto_approved"
  | "pending_human_approval"
  | "human_approved"
  | "rejected";
export type PaymentStatus =
  | "pending"
  | "scheduled"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled";
export type RuleEvaluationResult =
  | "approved_by_rules"
  | "blocked_by_rules"
  | "needs_review";
export type PaymentMethod = "ach" | "wire" | "card" | "check" | "crypto" | "other";

export interface AdminClientSummary {
  clientId: string;
  clientName: string;
  clientStatus: AdminClientStatus;
  primaryContactUserId: string;
  primaryContactName: string | null;
  primaryContactEmail: string;
  primaryContactRole: "owner" | "admin" | "finance" | "approver" | "viewer";
  defaultCurrency: string;
  agentCount: number;
  transactionCount: number;
  pendingApprovalCount: number;
  paidVolume: number;
  lastTransactionAt: string | null;
}

export type CompanyStatus = AdminClientStatus;
export type CompanySummary = AdminClientSummary;
export type AdminUserSummary = AdminClientSummary;

export interface AdminAgent {
  agentId: string;
  clientId: string;
  agentName: string;
  agentType: string | null;
  agentStatus: AgentStatus;
  apiKeyId: string | null;
  apiKeyPrefix: string | null;
  monthlyAllowance: number;
  approvalThreshold: number;
  maxTransactionAmount: number;
  currency: string;
  vendorAllowlist: string[];
  vendorDenylist: string[];
  allowedPaymentMethods: PaymentMethod[];
  riskLevel: string | null;
  lastActiveAt: string | null;
  description: string | null;
  createdByUserId: string | null;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTransactionAuditEvent {
  eventId: string;
  eventType: string;
  eventTimestamp: string;
  actorType: "system" | "user" | "agent";
  actorId: string | null;
  details: Record<string, unknown>;
}

export interface AdminTransaction {
  id: string;
  transactionId: string;
  clientId: string;
  vendorId: string;
  vendorNameSnapshot: string;
  agentId: string | null;
  agentName: string;
  walletId: string;
  walletName: string;
  requestedByUserId: string | null;
  transactionType: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  approvalStatus: ApprovalStatus;
  ruleEvaluationResult: RuleEvaluationResult;
  status: string;
  policyResult: string | null;
  reviewState: "pending" | "approved" | "rejected";
  humanApprovalRequired: boolean;
  humanApprovalReceived: boolean;
  humanApprovedByUserId: string | null;
  humanApprovedAt: string | null;
  requestedPaymentDatetime: string | null;
  scheduledPaymentDatetime: string | null;
  paidAt: string | null;
  invoiceFilePath: string | null;
  description: string | null;
  externalPaymentId: string | null;
  encryptedPaymentRefId: string | null;
  failureReason: string | null;
  complianceFlags: string[];
  metadata: Record<string, unknown>;
  recipient: string | null;
  vendor: string | null;
  category: string | null;
  memo: string | null;
  purpose: string | null;
  context: Record<string, unknown> | null;
  riskScore: number | null;
  riskFlags: string[];
  citedRules: Array<Record<string, unknown>>;
  agentDecision: Record<string, unknown> | null;
  matchedPayee: Record<string, unknown> | null;
  evidence: Array<Record<string, unknown>>;
  policyEvaluation: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
  railType: string | null;
  sourceKind: string | null;
  payoutStatus: string | null;
  payoutProvider: string | null;
  payoutExternalId: string | null;
  payoutError: string | null;
  payoutAttemptedAt: string | null;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  auditTrail: AdminTransactionAuditEvent[];
  manualReviewStatus: "pending" | "verified" | "rejected";
  manuallyVerifiedByUserId: string | null;
  manuallyVerifiedAt: string | null;
  isHumanApproved: boolean;
  isMade: boolean;
}

export interface ApprovalDecisionResult {
  transaction: AdminTransaction;
  reason?: string;
}
