import type { Agent, AgentApiKey } from "@prisma/client";
import { prisma } from "./prisma.js";
import type { PolicyEvaluationItem, PolicyResult } from "./types.js";
import type { PolicyOutcome } from "./policy.js";

export function centsToDollars(value?: number | null): number | null {
  if (value == null) return null;
  return value / 100;
}

export function dollarsToCents(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

function safeParseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
  } catch {
    // fall through
  }
  return [];
}

function safeParseObject(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {};
}

export function parseAgentSettings(agent: Agent): {
  vendorAllowlist: string[];
  vendorDenylist: string[];
  allowedPaymentMethods: string[];
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
} {
  return {
    vendorAllowlist: safeParseStringArray(agent.vendorAllowlistJson),
    vendorDenylist: safeParseStringArray(agent.vendorDenylistJson),
    allowedPaymentMethods: safeParseStringArray(agent.allowedPaymentMethodsJson),
    settings: safeParseObject(agent.settingsJson),
    metadata: safeParseObject(agent.metadataJson),
  };
}

export function validateAgentConfiguration(
  agent: Agent,
  activeKey: AgentApiKey | null
): {
  ok: boolean;
  status: string;
  issues: { check: string; result: "pass" | "fail"; detail?: string }[];
  apiKeyId: string | null;
} {
  const issues: { check: string; result: "pass" | "fail"; detail?: string }[] = [];

  if (agent.status !== "active") {
    issues.push({
      check: "Agent status",
      result: "fail",
      detail: `Status ${agent.status} — must be active to spend`,
    });
  } else {
    issues.push({ check: "Agent status", result: "pass" });
  }

  if (!agent.walletId) {
    issues.push({
      check: "Assigned wallet",
      result: "fail",
      detail: "Agent must be assigned to a wallet",
    });
  } else {
    issues.push({ check: "Assigned wallet", result: "pass" });
  }

  if (!activeKey) {
    issues.push({
      check: "API key",
      result: "fail",
      detail: "No active API key; create one from the dashboard",
    });
  } else {
    issues.push({ check: "API key", result: "pass" });
  }

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
    issues.push({
      check: "Capabilities",
      result: "fail",
      detail: "Agent should have a spend-related capability configured",
    });
  } else {
    issues.push({ check: "Capabilities", result: "pass" });
  }

  const ok = issues.every((i) => i.result === "pass");
  return {
    ok,
    status: ok ? "ready" : "needs_setup",
    issues,
    apiKeyId: activeKey?.id ?? null,
  };
}

export function isAgentSpendAllowedStatus(status: string): boolean {
  // Only fully active agents are allowed to initiate spend.
  // Other statuses like paused / revoked / deleted / disabled / needs_setup are blocked.
  return status === "active";
}

export async function agentMonthSpentCents(agentId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
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

type AgentGateInput = {
  amountCents: number;
  vendor?: string;
  railType?: string;
};

export type AgentSpendGateOutcome =
  | {
      kind: "block";
      outcome: PolicyOutcome;
      agentChecks: PolicyEvaluationItem[];
      forceHumanReview: boolean;
    }
  | {
      kind: "ok";
      outcome: null;
      agentChecks: PolicyEvaluationItem[];
      forceHumanReview: boolean;
    };

function makeBlockedOutcome(policyResult: PolicyResult, checks: PolicyEvaluationItem[]): PolicyOutcome {
  return {
    policyResult,
    policyEvaluation: checks,
    status: "blocked",
    reviewState: "rejected",
  };
}

export function evaluateAgentSpendGates(
  agent: Agent,
  input: AgentGateInput,
  monthSpentCents: number
): AgentSpendGateOutcome {
  const checks: PolicyEvaluationItem[] = [];
  const { amountCents, vendor, railType } = input;

  // 1. Agent status gate
  if (!isAgentSpendAllowedStatus(agent.status)) {
    checks.push({
      check: "Agent status",
      result: "fail",
      detail: `Status ${agent.status}`,
    });
    return {
      kind: "block",
      agentChecks: checks,
      forceHumanReview: false,
      outcome: makeBlockedOutcome("agent_inactive", checks),
    };
  }
  checks.push({ check: "Agent status", result: "pass" });

  // 2. Max per-transaction amount
  if (agent.maxTransactionAmountCents != null && amountCents > agent.maxTransactionAmountCents) {
    checks.push({
      check: "Agent max transaction",
      result: "fail",
      detail: "Amount exceeds agent maxTransactionAmount",
    });
    return {
      kind: "block",
      agentChecks: checks,
      forceHumanReview: false,
      outcome: makeBlockedOutcome("agent_max_transaction_exceeded", checks),
    };
  }
  checks.push({ check: "Agent max transaction", result: "pass" });

  // 3. Monthly allowance
  if (
    agent.monthlyAllowanceCents != null &&
    monthSpentCents + amountCents > agent.monthlyAllowanceCents
  ) {
    checks.push({
      check: "Agent monthly allowance",
      result: "fail",
      detail: "Would exceed agent monthly allowance",
    });
    return {
      kind: "block",
      agentChecks: checks,
      forceHumanReview: false,
      outcome: makeBlockedOutcome("agent_monthly_allowance_exceeded", checks),
    };
  }
  checks.push({ check: "Agent monthly allowance", result: "pass" });

  const { vendorAllowlist, vendorDenylist, allowedPaymentMethods } = parseAgentSettings(agent);

  // 4. Vendor denylist
  if (vendor && vendorDenylist.length) {
    const v = vendor.toLowerCase();
    const denied = vendorDenylist.some((x) => v.includes(x.toLowerCase()));
    if (denied) {
      checks.push({
        check: "Agent vendor denylist",
        result: "fail",
        detail: vendor,
      });
      return {
        kind: "block",
        agentChecks: checks,
        forceHumanReview: false,
        outcome: makeBlockedOutcome("agent_vendor_denied", checks),
      };
    }
  }
  checks.push({ check: "Agent vendor denylist", result: "pass" });

  // 5. Vendor allowlist (if configured, vendor must match one of the entries)
  if (vendor && vendorAllowlist.length) {
    const v = vendor.toLowerCase();
    const allowed = vendorAllowlist.some((x) => v.includes(x.toLowerCase()));
    if (!allowed) {
      checks.push({
        check: "Agent vendor allowlist",
        result: "fail",
        detail: vendor,
      });
      return {
        kind: "block",
        agentChecks: checks,
        forceHumanReview: false,
        outcome: makeBlockedOutcome("agent_vendor_not_allowlisted", checks),
      };
    }
  }
  checks.push({ check: "Agent vendor allowlist", result: "pass" });

  // 6. Allowed payment methods (rails)
  if (railType && allowedPaymentMethods.length) {
    if (!allowedPaymentMethods.includes(railType)) {
      checks.push({
        check: "Agent allowed payment methods",
        result: "fail",
        detail: `Rail "${railType}" not allowed for this agent`,
      });
      return {
        kind: "block",
        agentChecks: checks,
        forceHumanReview: false,
        outcome: makeBlockedOutcome("agent_payment_method_blocked", checks),
      };
    }
  }
  checks.push({ check: "Agent allowed payment methods", result: "pass" });

  // 7. Approval threshold (forces human review but does not hard-block)
  let forceHumanReview = false;
  if (agent.approvalThresholdCents != null && amountCents > agent.approvalThresholdCents) {
    forceHumanReview = true;
    checks.push({
      check: "Agent approval threshold",
      result: "fail",
      detail: "Above agent approvalThreshold, requires human review",
    });
  } else {
    checks.push({ check: "Agent approval threshold", result: "pass" });
  }

  return {
    kind: "ok",
    forceHumanReview,
    agentChecks: checks,
    outcome: null,
  };
}
