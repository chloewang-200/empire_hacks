import type { Agent as PrismaAgent, AgentApiKey } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { PolicyEvaluationItem } from "./types.js";
import type { PolicyOutcome } from "./policy.js";

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function dollarsToCents(n: number): number {
  return Math.round(n * 100);
}

export function centsToDollars(cents: number | null | undefined): number | null {
  if (cents == null) return null;
  return Math.round(cents) / 100;
}

/** Calendar month (UTC) spend for this agent, same statuses as daily wallet rollup. */
export async function agentMonthSpentCents(
  agentId: string,
  month: Date = new Date()
): Promise<number> {
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 0, 0, 0, 0));
  const agg = await prisma.transaction.aggregate({
    where: {
      agentId,
      createdAt: { gte: start },
      status: { in: ["approved", "pending_review", "settled"] },
    },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

const ACTIVE_STATUSES = new Set(["active"]);

export function isAgentSpendAllowedStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export type AgentGovernanceInput = {
  amountCents: number;
  vendor?: string;
  category?: string;
  /** Normalized rail id, e.g. merchant_card */
  railType: string;
  /** Resolved approved payee from directory / explicit payeeId */
  hasApprovedPayeeMatch: boolean;
};

/**
 * Hard gates before wallet policy. Returns a block outcome, or { pass, forceHumanReview } when only threshold applies.
 */
export function evaluateAgentSpendGates(
  agent: Pick<
    PrismaAgent,
    | "status"
    | "monthlyAllowanceCents"
    | "approvalThresholdCents"
    | "maxTransactionAmountCents"
    | "dailySpendLimitCents"
    | "requireApprovedPayee"
    | "vendorAllowlistJson"
    | "vendorDenylistJson"
    | "allowedPaymentMethodsJson"
    | "allowedPayoutRailsJson"
    | "allowedCategoriesJson"
    | "restrictedVendorsJson"
  >,
  input: AgentGovernanceInput,
  monthSpentCents: number,
  daySpentCents: number
):
  | { kind: "block"; outcome: PolicyOutcome }
  | { kind: "review"; outcome: PolicyOutcome }
  | { kind: "pass"; forceHumanReview: boolean; agentChecks: PolicyEvaluationItem[] } {
  const checks: PolicyEvaluationItem[] = [];

  if (!isAgentSpendAllowedStatus(agent.status)) {
    checks.push({
      check: "Agent status",
      result: "fail",
      detail: `Agent is ${agent.status} — only active agents may request spend`,
    });
    return {
      kind: "block",
      outcome: {
        policyResult: "agent_inactive",
        policyEvaluation: checks,
        status: "blocked",
        reviewState: "rejected",
      },
    };
  }
  checks.push({ check: "Agent status", result: "pass", detail: "active" });

  if (agent.requireApprovedPayee && !input.hasApprovedPayeeMatch) {
    checks.push({
      check: "Agent approved payee",
      result: "fail",
      detail: "This agent may only pay matched Payees — pass payeeId or a vendor string that matches the directory",
    });
    return {
      kind: "review",
      outcome: {
        policyResult: "payee_not_matched",
        policyEvaluation: checks,
        status: "pending_review",
        reviewState: "pending",
      },
    };
  }
  checks.push({
    check: "Agent approved payee",
    result: "pass",
    detail: input.hasApprovedPayeeMatch ? "Matched payee" : "Not required on this agent",
  });

  const agentRestricted = parseJsonArray(agent.restrictedVendorsJson);
  const vLower = input.vendor?.toLowerCase().trim() ?? "";
  if (agentRestricted.length && vLower) {
    const hit = agentRestricted.some((x) => vLower.includes(x.toLowerCase()));
    if (hit) {
      checks.push({
        check: "Agent restricted vendors",
        result: "fail",
        detail: input.vendor ?? "",
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "vendor_restricted",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
  }
  checks.push({ check: "Agent restricted vendors", result: "pass" });

  const agentCategories = parseJsonArray(agent.allowedCategoriesJson);
  if (agentCategories.length && input.category?.trim()) {
    const ok = agentCategories.some(
      (c) => c.toLowerCase() === input.category!.trim().toLowerCase()
    );
    if (!ok) {
      checks.push({
        check: "Agent allowed categories",
        result: "fail",
        detail: input.category,
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "category_not_allowed",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
  }
  checks.push({ check: "Agent allowed categories", result: "pass" });

  if (agent.maxTransactionAmountCents != null && input.amountCents > agent.maxTransactionAmountCents) {
    checks.push({
      check: "Agent max transaction",
      result: "fail",
      detail: `Amount exceeds agent max transaction (${agent.maxTransactionAmountCents / 100} major units)`,
    });
    return {
      kind: "block",
      outcome: {
        policyResult: "agent_max_transaction_exceeded",
        policyEvaluation: checks,
        status: "blocked",
        reviewState: "rejected",
      },
    };
  }
  checks.push({
    check: "Agent max transaction",
    result: "pass",
    detail:
      agent.maxTransactionAmountCents != null
        ? `Within ${agent.maxTransactionAmountCents / 100} (major units) ceiling`
        : "No agent max set",
  });

  if (agent.dailySpendLimitCents != null) {
    if (daySpentCents + input.amountCents > agent.dailySpendLimitCents) {
      checks.push({
        check: "Agent daily spend limit",
        result: "fail",
        detail: "Would exceed this agent's daily limit",
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "agent_daily_limit_exceeded",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
    checks.push({ check: "Agent daily spend limit", result: "pass" });
  } else {
    checks.push({ check: "Agent daily spend limit", result: "pass", detail: "No agent daily cap" });
  }

  if (agent.monthlyAllowanceCents != null) {
    if (monthSpentCents + input.amountCents > agent.monthlyAllowanceCents) {
      checks.push({
        check: "Agent monthly allowance",
        result: "fail",
        detail: "Would exceed agent monthly allowance",
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "agent_monthly_allowance_exceeded",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
    checks.push({ check: "Agent monthly allowance", result: "pass" });
  } else {
    checks.push({ check: "Agent monthly allowance", result: "pass", detail: "No agent monthly cap" });
  }

  const deny = parseJsonArray(agent.vendorDenylistJson);
  if (deny.length && vLower) {
    const hit = deny.some((d) => vLower.includes(d.toLowerCase()));
    if (hit) {
      checks.push({
        check: "Agent vendor denylist",
        result: "fail",
        detail: input.vendor ?? "",
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "agent_vendor_denied",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
  }
  checks.push({ check: "Agent vendor denylist", result: "pass" });

  const payoutRails = parseJsonArray(agent.allowedPayoutRailsJson);
  if (payoutRails.length) {
    const rail = input.railType.toLowerCase();
    const ok = payoutRails.some((r) => r.toLowerCase() === rail);
    if (!ok) {
      checks.push({
        check: "Agent allowed payout rails",
        result: "fail",
        detail: `Rail "${input.railType}" is not allowed for this agent`,
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "payout_rail_not_allowed",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
  }
  checks.push({ check: "Agent allowed payout rails", result: "pass" });

  const allow = parseJsonArray(agent.vendorAllowlistJson);
  if (allow.length) {
    if (!vLower) {
      checks.push({
        check: "Agent vendor allowlist",
        result: "fail",
        detail: "Vendor required when allowlist is configured",
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "agent_vendor_not_allowlisted",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
    const ok = allow.some((a) => vLower.includes(a.toLowerCase()) || a.toLowerCase().includes(vLower));
    if (!ok) {
      checks.push({
        check: "Agent vendor allowlist",
        result: "fail",
        detail: "Vendor did not match allowlist",
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "agent_vendor_not_allowlisted",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
  }
  checks.push({ check: "Agent vendor allowlist", result: "pass" });

  const methods = parseJsonArray(agent.allowedPaymentMethodsJson).map((m) => m.toLowerCase());
  if (methods.length) {
    const rail = input.railType.toLowerCase();
    if (!methods.includes(rail)) {
      checks.push({
        check: "Agent allowed payment methods",
        result: "fail",
        detail: `Rail "${input.railType}" not in allowed list`,
      });
      return {
        kind: "block",
        outcome: {
          policyResult: "agent_payment_method_blocked",
          policyEvaluation: checks,
          status: "blocked",
          reviewState: "rejected",
        },
      };
    }
  }
  checks.push({ check: "Agent allowed payment methods", result: "pass" });

  const forceHumanReview =
    agent.approvalThresholdCents != null && input.amountCents > agent.approvalThresholdCents;
  if (agent.approvalThresholdCents != null) {
    checks.push({
      check: "Agent approval threshold",
      result: "pass",
      detail: forceHumanReview
        ? `Amount exceeds threshold (${agent.approvalThresholdCents / 100} major units) — human review required`
        : "Within agent approval threshold",
    });
  } else {
    checks.push({ check: "Agent approval threshold", result: "pass", detail: "No threshold set" });
  }

  return { kind: "pass", forceHumanReview, agentChecks: checks };
}

export type ValidateAgentChecks = {
  isActive: boolean;
  hasApiKey: boolean;
  hasSpendCapability: boolean;
  hasValidAllowance: boolean;
  hasValidDailyLimit: boolean;
  hasValidApprovalThreshold: boolean;
  hasValidMaxTransaction: boolean;
  hasNoAllowDenyConflict: boolean;
};

export function validateAgentConfiguration(
  agent: PrismaAgent,
  activeKey: AgentApiKey | null | undefined
): {
  agentId: string;
  valid: boolean;
  checks: ValidateAgentChecks;
  issues: string[];
} {
  const issues: string[] = [];
  const allow = parseJsonArray(agent.vendorAllowlistJson);
  const deny = parseJsonArray(agent.vendorDenylistJson);
  const allowLower = new Set(allow.map((x) => x.toLowerCase()));
  const conflict = deny.some((d) => allowLower.has(d.toLowerCase()));

  const isActive = isAgentSpendAllowedStatus(agent.status);
  if (!isActive) issues.push(`Agent status is "${agent.status}" (must be active for spend).`);

  const hasApiKey = Boolean(activeKey && !activeKey.revokedAt);
  if (!hasApiKey) issues.push("No active API key.");

  const hasSpendCapability = (() => {
    try {
      const caps = JSON.parse(agent.capabilitiesJson ?? "[]") as unknown;
      if (Array.isArray(caps)) {
        return caps.some((c) => String(c).toLowerCase().includes("spend"));
      }
    } catch {
      // ignore
    }
    return false;
  })();
  if (!hasSpendCapability) {
    issues.push("Agent should have a spend-related capability configured (e.g. spend_request).");
  }

  const hasValidAllowance =
    agent.monthlyAllowanceCents == null || agent.monthlyAllowanceCents > 0;
  if (!hasValidAllowance) issues.push("monthlyAllowance must be null or positive when set.");

  const hasValidApprovalThreshold =
    agent.approvalThresholdCents == null || agent.approvalThresholdCents > 0;
  if (!hasValidApprovalThreshold) issues.push("approvalThreshold must be null or positive when set.");

  const hasValidMaxTransaction =
    agent.maxTransactionAmountCents == null || agent.maxTransactionAmountCents > 0;
  if (!hasValidMaxTransaction) issues.push("maxTransactionAmount must be null or positive when set.");

  const hasValidDaily =
    agent.dailySpendLimitCents == null || agent.dailySpendLimitCents > 0;
  if (!hasValidDaily) issues.push("dailySpendLimit must be null or positive when set.");

  let thresholdOk = hasValidApprovalThreshold;
  if (agent.approvalThresholdCents != null && agent.maxTransactionAmountCents != null) {
    if (agent.approvalThresholdCents > agent.maxTransactionAmountCents) {
      issues.push("approvalThreshold should not exceed maxTransactionAmount.");
      thresholdOk = false;
    }
  }

  const hasNoAllowDenyConflict = !conflict;
  if (conflict) issues.push("Vendor allowlist and denylist overlap.");

  const checks: ValidateAgentChecks = {
    isActive,
    hasApiKey,
    hasSpendCapability,
    hasValidAllowance,
    hasValidDailyLimit: hasValidDaily,
    hasValidApprovalThreshold: hasValidApprovalThreshold && thresholdOk,
    hasValidMaxTransaction,
    hasNoAllowDenyConflict,
  };

  const valid = issues.length === 0;
  return { agentId: agent.id, valid, checks, issues };
}

export function parseAgentSettings(agent: PrismaAgent) {
  return {
    vendorAllowlist: parseJsonArray(agent.vendorAllowlistJson),
    vendorDenylist: parseJsonArray(agent.vendorDenylistJson),
    allowedPaymentMethods: parseJsonArray(agent.allowedPaymentMethodsJson),
    allowedPayoutRails: parseJsonArray(agent.allowedPayoutRailsJson),
    allowedCategories: parseJsonArray(agent.allowedCategoriesJson),
    restrictedVendors: parseJsonArray(agent.restrictedVendorsJson),
    settings: parseJsonObject(agent.settingsJson),
    metadata: parseJsonObject(agent.metadataJson),
  };
}
