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
  /** When true, vendor must match an approved payee (or explicit payeeId) or request goes to review */
  requireApprovedPayee?: boolean;
  /** After policy approves, attempt real money movement (Stripe Connect, etc.) */
  autoExecutePayout?: boolean;
  /** If set, requested payout rail must be one of these (e.g. stripe_connect, venmo_p2p) */
  allowedPayoutRails?: string[];
}

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
  | "connect_payment_method_required"
  | "agent_inactive"
  | "agent_max_transaction_exceeded"
  | "agent_monthly_allowance_exceeded"
  | "agent_daily_limit_exceeded"
  | "agent_vendor_denied"
  | "agent_vendor_not_allowlisted"
  | "agent_payment_method_blocked";

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
