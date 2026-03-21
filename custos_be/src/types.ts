/** Mirrors custos_fe Transaction / policy types (subset for server) */

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

export type PolicyResult =
  | "within_policy"
  | "over_limit"
  | "vendor_restricted"
  | "missing_proof"
  | "needs_manual_approval"
  | "category_not_allowed"
  | "agent_capability_not_allowed";

export type TransactionStatus =
  | "approved"
  | "blocked"
  | "pending_review"
  | "settled"
  | "canceled";

export interface PolicyEvaluationItem {
  check: string;
  result: "pass" | "fail";
  detail?: string;
}
