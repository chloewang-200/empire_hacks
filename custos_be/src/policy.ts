import type {
  PolicyEvaluationItem,
  PolicyResult,
  TransactionStatus,
  WalletPolicy,
} from "./types.js";

export interface PolicyInput {
  policy: WalletPolicy;
  amountCents: number;
  /** Total spent today from this wallet (same currency), in cents */
  walletDailySpentCents: number;
  vendor?: string;
  category?: string;
  /** If strict / review, require evidence for high amounts */
  hasEvidence: boolean;
}

export type PolicyOutcome = {
  policyResult: PolicyResult;
  policyEvaluation: PolicyEvaluationItem[];
  /** Suggested status before spend-mode branching */
  status: TransactionStatus;
  reviewState: "pending" | "approved" | "rejected" | null;
};

export function evaluatePolicy(input: PolicyInput): PolicyOutcome {
  const checks: PolicyEvaluationItem[] = [];
  const { policy, amountCents, walletDailySpentCents, vendor, category, hasEvidence } = input;
  const limits = policy.limits ?? {};
  const perTx = limits.perTransaction != null ? Math.round(limits.perTransaction * 100) : null;
  const daily = limits.daily != null ? Math.round(limits.daily * 100) : null;

  let overLimit = false;
  if (perTx != null && amountCents > perTx) {
    checks.push({
      check: "Per-transaction limit",
      result: "fail",
      detail: `Amount exceeds ${limits.perTransaction} (per-transaction limit)`,
    });
    overLimit = true;
  } else {
    checks.push({ check: "Per-transaction limit", result: "pass" });
  }

  if (daily != null && walletDailySpentCents + amountCents > daily) {
    checks.push({
      check: "Daily spend limit",
      result: "fail",
      detail: "Would exceed daily limit",
    });
    overLimit = true;
  } else {
    checks.push({ check: "Daily spend limit", result: "pass" });
  }

  if (policy.restrictedVendors?.length && vendor) {
    const v = vendor.toLowerCase();
    const hit = policy.restrictedVendors.some((x) => v.includes(x.toLowerCase()));
    if (hit) {
      checks.push({ check: "Vendor restrictions", result: "fail", detail: vendor });
      return {
        policyResult: "vendor_restricted",
        policyEvaluation: checks,
        status: "blocked",
        reviewState: "rejected",
      };
    }
  }
  checks.push({ check: "Vendor restrictions", result: "pass" });

  if (policy.allowedCategories?.length && category) {
    const ok = policy.allowedCategories.some((c) => c.toLowerCase() === category.toLowerCase());
    if (!ok) {
      checks.push({ check: "Category allowed", result: "fail", detail: category });
      return {
        policyResult: "category_not_allowed",
        policyEvaluation: checks,
        status: "blocked",
        reviewState: "rejected",
      };
    }
  }
  checks.push({ check: "Category allowed", result: "pass" });

  if (overLimit) {
    return {
      policyResult: "over_limit",
      policyEvaluation: checks,
      status: "blocked",
      reviewState: "rejected",
    };
  }

  if (policy.approvalMode === "strict" && amountCents > 0 && !hasEvidence) {
    checks.push({
      check: "Supporting evidence",
      result: "fail",
      detail: "Evidence required in strict mode",
    });
    return {
      policyResult: "missing_proof",
      policyEvaluation: checks,
      status: "pending_review",
      reviewState: "pending",
    };
  }
  checks.push({ check: "Supporting evidence", result: hasEvidence ? "pass" : "pass" });

  if (policy.approvalMode === "review" || policy.approvalMode === "strict") {
    return {
      policyResult: "needs_manual_approval",
      policyEvaluation: checks,
      status: "pending_review",
      reviewState: "pending",
    };
  }

  // auto
  return {
    policyResult: "within_policy",
    policyEvaluation: checks,
    status: "approved",
    reviewState: "approved",
  };
}
