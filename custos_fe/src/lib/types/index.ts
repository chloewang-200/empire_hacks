// Domain models for Custos — spend governance for AI agents

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export type AgentStatus = "active" | "disabled" | "paused" | "needs_setup";
export type AgentRole = "viewer" | "requester" | "approver" | "admin";

export interface AgentCapability {
  id: string;
  name: string;
  description?: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  status: "available" | "coming_soon";
  expectedInputs?: string[];
  permissionsNeeded?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  assignedWalletId: string;
  assignedWalletName?: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  status: AgentStatus;
  lastActiveAt?: string;
  transactionVolume?: number;
  transactionCount?: number;
  createdAt: string;
  updatedAt: string;
  /** Spec / API: mirrors workspace id */
  clientId?: string;
  agentId?: string;
  agentName?: string;
  agentType?: string | null;
  agentStatus?: string;
  apiKeyId?: string;
  apiKeyPrefix?: string | null;
  /** Budget fields in major currency units (API). */
  monthlyAllowance?: number | null;
  approvalThreshold?: number | null;
  maxTransactionAmount?: number | null;
  currency?: string;
  vendorAllowlist?: string[];
  vendorDenylist?: string[];
  allowedPaymentMethods?: string[];
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdByUserId?: string;
}

export type WalletStatus = "active" | "paused" | "restricted";
export type ApprovalMode = "auto" | "review" | "strict";

export interface WalletLimit {
  daily?: number;
  perTransaction?: number;
}

export interface WalletPolicy {
  approvalMode: ApprovalMode;
  limits: WalletLimit;
  allowedCategories?: string[];
  allowedVendors?: string[];
  restrictedVendors?: string[];
  /** When true, spend requests must match an approved payee or go to review */
  requireApprovedPayee?: boolean;
  /** After policy approves, attempt real payout (e.g. Stripe Connect transfer) */
  autoExecutePayout?: boolean;
  /** Requested rail must be in this list when set (e.g. stripe_connect, merchant_card) */
  allowedPayoutRails?: string[];
}

export interface Wallet {
  id: string;
  name: string;
  currency: string;
  balance: number;
  policy: WalletPolicy;
  assignedAgentsCount: number;
  status: WalletStatus;
  createdAt: string;
  updatedAt: string;
}

export type TransactionStatus =
  | "approved"
  | "blocked"
  | "pending_review"
  | "settled"
  | "canceled";

export type PolicyResult =
  | "within_policy"
  | "over_limit"
  | "vendor_restricted"
  | "missing_proof"
  | "needs_manual_approval"
  | "category_not_allowed"
  | "agent_capability_not_allowed"
  | "payee_not_matched"
  | "insufficient_balance"
  | "payout_rail_not_allowed"
  | "agent_inactive"
  | "agent_max_transaction_exceeded"
  | "agent_monthly_allowance_exceeded"
  | "agent_vendor_denied"
  | "agent_vendor_not_allowlisted"
  | "agent_payment_method_blocked";

export interface Evidence {
  id: string;
  type: string;
  url?: string;
  filename?: string;
  extractedFields?: Record<string, unknown>;
  confidence?: number;
  uploadedAt: string;
}

/** How the payment is intended to be fulfilled (ACH, card, Venmo, etc.) */
export type TransactionRailType =
  | "merchant_card"
  | "ach"
  | "bank_transfer"
  | "venmo_p2p"
  | "paypal"
  | "wire"
  | "other";

export type TransactionSourceKind = "api" | "invoice_upload" | "manual";

export interface MatchedPayeeSummary {
  id: string;
  displayName: string;
  defaultRail: string;
  paymentInstructions?: string;
  /** Stripe Connect destination acct_… when configured */
  stripeConnectAccountId?: string;
}

export interface Transaction {
  id: string;
  requestedAt: string;
  agentId: string;
  agentName: string;
  walletId: string;
  walletName: string;
  recipient?: string;
  vendor?: string;
  category?: string;
  amount: number;
  currency: string;
  memo?: string;
  /** Agent-declared reason for the spend (audit) */
  purpose?: string;
  /** Structured metadata from the agent (audit) */
  context?: Record<string, unknown>;
  matchedPayee?: MatchedPayeeSummary;
  status: TransactionStatus;
  policyResult?: PolicyResult;
  reviewState?: "pending" | "approved" | "rejected";
  evidence?: Evidence[];
  policyEvaluation?: PolicyEvaluationItem[];
  auditEvents?: AuditEvent[];
  settledAt?: string;
  /** Payout / rail classification */
  railType?: TransactionRailType | string;
  sourceKind?: TransactionSourceKind | string;
  payoutStatus?: string;
  payoutProvider?: string;
  payoutExternalId?: string;
  payoutError?: string;
  payoutAttemptedAt?: string;
}

export interface PolicyEvaluationItem {
  check: string;
  result: "pass" | "fail";
  detail?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  actor?: string;
  detail?: string;
  /** request | agent_context | payee_resolution | evidence | policy | human */
  type?: string;
}

export interface ApprovedPayee {
  id: string;
  displayName: string;
  legalName?: string;
  aliases: string[];
  defaultRail: string;
  paymentInstructions?: string;
  stripeConnectAccountId?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewItem {
  transactionId: string;
  transaction: Transaction;
  flaggedReason?: string;
  ageMinutes: number;
  reviewerStatus?: "pending" | "reviewed";
}

export interface InvoiceExtractionResult {
  vendor?: string;
  invoiceNumber?: string;
  amount?: number;
  dueDate?: string;
  memo?: string;
  confidence?: number;
  sourceFileId?: string;
  rawFields?: Record<string, unknown>;
  /** Suggested payout rail from extraction heuristics */
  railType?: TransactionRailType | string;
}

export interface ApiKeyResponse {
  keyPrefix: string;
  /** Full key shown only once; do not store in frontend. */
  fullKey?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
