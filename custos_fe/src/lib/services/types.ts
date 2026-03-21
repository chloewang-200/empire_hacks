export type PaymentMethod =
  | "ach"
  | "wire"
  | "card"
  | "check"
  | "crypto"
  | "other";

export interface PaginatedList<T> {
  items: T[];
  nextCursor?: string | null;
}

export interface VendorContact {
  name?: string;
  email?: string;
  phone?: string;
}

export interface VendorRule {
  maxAmountPerTransaction: number | null;
  paymentFrequency: string | null;
  preferredPaymentMethods: PaymentMethod[];
  requiresHumanApprovalAbove: number | null;
}

export interface Vendor {
  vendorId: string;
  clientId: string;
  vendorName: string;
  vendorLegalName: string | null;
  vendorStatus: "active" | "inactive" | "blocked" | "under_review";
  contact: VendorContact | null;
  paymentMethodsSupported: PaymentMethod[];
  preferredPaymentMethod: PaymentMethod | null;
  encryptedPaymentRefId: string | null;
  defaultCurrency: string | null;
  vendorCategory: string | null;
  rules: VendorRule;
  notes: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionAuditEvent {
  eventId: string;
  eventType: string;
  eventTimestamp: string;
  actorType: "system" | "user" | "agent";
  actorId: string | null;
  details: Record<string, unknown>;
}

export interface Transaction {
  transactionId: string;
  clientId: string;
  vendorId: string;
  vendorNameSnapshot: string;
  agentId: string | null;
  requestedByUserId: string | null;
  transactionType: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus:
    | "pending"
    | "scheduled"
    | "processing"
    | "paid"
    | "failed"
    | "cancelled";
  approvalStatus:
    | "auto_approved"
    | "pending_human_approval"
    | "human_approved"
    | "rejected";
  ruleEvaluationResult:
    | "approved_by_rules"
    | "blocked_by_rules"
    | "needs_review";
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
  createdAt: string;
  updatedAt: string;
  auditTrail?: TransactionAuditEvent[];
}

export interface ApprovalDecision {
  approvalDecisionId: string;
  transactionId: string;
  approvedByUserId: string;
  decision: "approved" | "rejected";
  reason: string | null;
  createdAt: string;
}

export interface Agent {
  agentId: string;
  clientId: string;
  agentName: string;
  agentType: string | null;
  agentStatus: "active" | "paused" | "revoked" | "deleted";
  apiKeyId: string;
  apiKeyPrefix: string | null;
  monthlyAllowance: number;
  approvalThreshold: number;
  maxTransactionAmount: number;
  currency: string;
  vendorAllowlist: string[];
  vendorDenylist: string[];
  allowedPaymentMethods: PaymentMethod[];
  description: string | null;
  createdByUserId: string | null;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  clientId: string;
  email: string;
  fullName: string | null;
  role: "owner" | "admin" | "finance" | "approver" | "viewer";
  status: "active" | "invited" | "disabled";
  phoneNumber: string | null;
  jobTitle: string | null;
  timezone: string | null;
  defaultCurrency: string | null;
  defaultPaymentMethod: PaymentMethod | null;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
  approvalNotificationsEnabled: boolean;
  theme: string | null;
  preferences: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface VendorValidationResult {
  vendorId: string;
  valid: boolean;
  checks: {
    hasPaymentMethod: boolean;
    hasValidRules: boolean;
    hasPaymentReference: boolean;
    isNotBlocked: boolean;
  };
  issues: string[];
}

export interface AgentValidationResult {
  agentId: string;
  valid: boolean;
  checks: {
    isActive: boolean;
    hasApiKey: boolean;
    hasValidAllowance: boolean;
    hasValidApprovalThreshold: boolean;
    hasValidMaxTransaction: boolean;
    hasNoAllowDenyConflict: boolean;
  };
  issues: string[];
}

export interface TransactionValidationResult {
  transactionId: string;
  valid: boolean;
  result: "approved_by_rules" | "blocked_by_rules" | "needs_review";
  paymentStatus: string;
  approvalStatus: string;
  humanApprovalRequired: boolean;
  triggeredRules: Array<{
    source: "vendor" | "agent" | "system";
    rule: string;
    message: string;
  }>;
  complianceFlags: string[];
  evaluatedAt: string;
}

export interface TransactionValidationContext {
  transaction: Transaction;
  vendor: Vendor | null;
  agent: Agent | null;
}

export interface TransactionValidationPreview {
  valid: boolean;
  result: "approved_by_rules" | "blocked_by_rules" | "needs_review";
  humanApprovalRequired: boolean;
  triggeredRules: Array<{
    source: "vendor" | "agent" | "system";
    rule: string;
    message: string;
  }>;
  complianceFlags: string[];
}

export interface UploadUrlResult {
  uploadUrl: string;
  filePath: string;
  expiresAt: string;
}
