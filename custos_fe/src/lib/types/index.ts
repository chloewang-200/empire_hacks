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
  | "agent_capability_not_allowed";

export interface Evidence {
  id: string;
  type: string;
  url?: string;
  filename?: string;
  extractedFields?: Record<string, unknown>;
  confidence?: number;
  uploadedAt: string;
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
  status: TransactionStatus;
  policyResult?: PolicyResult;
  reviewState?: "pending" | "approved" | "rejected";
  evidence?: Evidence[];
  policyEvaluation?: PolicyEvaluationItem[];
  auditEvents?: AuditEvent[];
  settledAt?: string;
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
