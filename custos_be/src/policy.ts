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
  /** Matched approved payee (explicit or vendor directory) */
  hasApprovedPayeeMatch: boolean;
  /** Current wallet prefunded balance (cents) — required when autoExecutePayout is on */
  walletBalanceCents?: number;
  /** Normalized payout rail from agent request / payee default */
  requestedPayoutRail?: string;
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
  const {
    policy,
    amountCents,
    walletDailySpentCents,
    vendor,
    category,
    hasEvidence,
    hasApprovedPayeeMatch,
    walletBalanceCents,
    requestedPayoutRail,
  } = input;
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

  if (policy.requireApprovedPayee) {
    if (!hasApprovedPayeeMatch) {
      checks.push({
        check: "Approved payee",
        result: "fail",
        detail: "Vendor did not match an approved payee — add one in Payees or pass payeeId",
      });
      return {
        policyResult: "payee_not_matched",
        policyEvaluation: checks,
        status: "pending_review",
        reviewState: "pending",
      };
    }
    checks.push({ check: "Approved payee", result: "pass", detail: "Matched to payee directory" });
  } else {
    checks.push({
      check: "Approved payee",
      result: "pass",
      detail: hasApprovedPayeeMatch ? "Matched (optional)" : "Directory not required",
    });
  }

  if (overLimit) {
    return {
      policyResult: "over_limit",
      policyEvaluation: checks,
      status: "blocked",
      reviewState: "rejected",
    };
  }

  if (policy.autoExecutePayout) {
    const bal = walletBalanceCents ?? 0;
    if (bal < amountCents) {
      checks.push({
        check: "Wallet balance for auto payout",
        result: "fail",
        detail: "Prefunded balance is below this amount — add funds or disable auto payout",
      });
      return {
        policyResult: "insufficient_balance",
        policyEvaluation: checks,
        status: "blocked",
        reviewState: "rejected",
      };
    }
    checks.push({ check: "Wallet balance for auto payout", result: "pass" });

    if (policy.allowedPayoutRails?.length && requestedPayoutRail) {
      const ok = policy.allowedPayoutRails.includes(requestedPayoutRail);
      if (!ok) {
        checks.push({
          check: "Payout rail allow-list",
          result: "fail",
          detail: `Rail "${requestedPayoutRail}" is not allowed on this wallet`,
        });
        return {
          policyResult: "payout_rail_not_allowed",
          policyEvaluation: checks,
          status: "pending_review",
          reviewState: "pending",
        };
      }
    }
    checks.push({
      check: "Payout rail allow-list",
      result: "pass",
      detail: policy.allowedPayoutRails?.length
        ? `Rail "${requestedPayoutRail ?? "default"}" allowed`
        : "No rail restriction",
    });
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

export function applySpendMode(spendMode: string, outcome: PolicyOutcome): PolicyOutcome {
  if (spendMode !== "MANUAL_REAL") return outcome;
  if (outcome.status === "approved") {
    return {
      ...outcome,
      policyResult: "needs_manual_approval",
      status: "pending_review",
      reviewState: "pending",
    };
  }
  return outcome;
}
