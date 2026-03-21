import type { Agent as PrismaAgent, Transaction as PrismaTransaction, Wallet as PrismaWallet } from "@prisma/client";
import { centsToDollars, parseAgentSettings } from "./agentGovernance.js";
import type { WalletPolicy } from "./types.js";

export function parseWalletPolicy(json: string): WalletPolicy {
  try {
    const p = JSON.parse(json) as WalletPolicy;
    return {
      approvalMode: p.approvalMode ?? "review",
      limits: p.limits ?? {},
      allowedCategories: p.allowedCategories,
      allowedVendors: p.allowedVendors,
      restrictedVendors: p.restrictedVendors,
      requireApprovedPayee: Boolean(p.requireApprovedPayee),
      autoExecutePayout: Boolean(p.autoExecutePayout),
      allowedPayoutRails: Array.isArray(p.allowedPayoutRails)
        ? (p.allowedPayoutRails as string[])
        : undefined,
    };
  } catch {
    return { approvalMode: "review", limits: {} };
  }
}

export function walletToJson(
  w: PrismaWallet & { agents?: { id: string }[] },
  assignedAgentsCount?: number
): Record<string, unknown> {
  const count = assignedAgentsCount ?? w.agents?.length ?? 0;
  return {
    id: w.id,
    name: w.name,
    currency: w.currency,
    balance: w.balanceCents / 100,
    fundingModel: w.fundingModel ?? "prefund",
    stripeCustomerId: w.stripeCustomerId ?? undefined,
    hasDefaultPaymentMethod: Boolean(w.stripeDefaultPaymentMethodId),
    policy: parseWalletPolicy(w.policyJson),
    assignedAgentsCount: count,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function agentToJson(
  a: PrismaAgent & {
    wallet?: { name: string };
    apiKeys?: { id: string; keyPrefix: string; revokedAt: Date | null }[];
  }
): Record<string, unknown> {
  let capabilities: { id: string; name: string }[] = [];
  try {
    const caps = JSON.parse(a.capabilitiesJson) as string[];
    capabilities = caps.map((c) => ({ id: c, name: c }));
  } catch {
    capabilities = [];
  }
  const activeKeys = (a.apiKeys ?? []).filter((k) => k.revokedAt == null);
  const activeKey = activeKeys[0];
  const lists = parseAgentSettings(a);
  const displayPrefix =
    activeKey && activeKey.keyPrefix.length >= 8
      ? `${activeKey.keyPrefix.slice(0, 8)}…`
      : activeKey?.keyPrefix;

  return {
    id: a.id,
    name: a.name,
    description: a.description ?? undefined,
    templateType: a.templateType,
    assignedWalletId: a.walletId,
    assignedWalletName: a.wallet?.name,
    role: a.role,
    capabilities,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    createdByUserId: a.createdByUserId ?? undefined,
    agentType: a.agentType ?? undefined,
    monthlyAllowance: centsToDollars(a.monthlyAllowanceCents),
    approvalThreshold: centsToDollars(a.approvalThresholdCents),
    maxTransactionAmount: centsToDollars(a.maxTransactionAmountCents),
    dailySpendLimit: centsToDollars(a.dailySpendLimitCents),
    currency: a.budgetCurrency,
    requireApprovedPayee: a.requireApprovedPayee,
    vendorAllowlist: lists.vendorAllowlist,
    vendorDenylist: lists.vendorDenylist,
    allowedPaymentMethods: lists.allowedPaymentMethods,
    allowedPayoutRails: lists.allowedPayoutRails,
    allowedCategories: lists.allowedCategories,
    restrictedVendors: lists.restrictedVendors,
    settings: lists.settings,
    metadata: lists.metadata,
    agentId: a.id,
    clientId: a.workspaceId,
    agentName: a.name,
    agentStatus: a.status,
    apiKeyId: activeKey?.id,
    apiKeyPrefix: displayPrefix ?? null,
  };
}

export function transactionToJson(
  tx: PrismaTransaction & {
    agent?: { name: string };
    wallet?: { name: string };
    payee?: {
      id: string;
      displayName: string;
      defaultRail: string;
      paymentInstructions: string | null;
      stripeConnectAccountId: string | null;
    } | null;
  }
): Record<string, unknown> {
  let evidence: unknown[] = [];
  try {
    evidence = JSON.parse(tx.evidenceJson ?? "[]") as unknown[];
  } catch {
    evidence = [];
  }
  let policyEvaluation: unknown[] = [];
  try {
    policyEvaluation = JSON.parse(tx.policyEvalJson ?? "[]") as unknown[];
  } catch {
    policyEvaluation = [];
  }
  let auditEvents: unknown[] = [];
  try {
    auditEvents = JSON.parse(tx.auditJson ?? "[]") as unknown[];
  } catch {
    auditEvents = [];
  }
  let context: Record<string, unknown> | undefined;
  try {
    if (tx.contextJson) context = JSON.parse(tx.contextJson) as Record<string, unknown>;
  } catch {
    context = undefined;
  }

  let riskFlags: string[] = [];
  try {
    const rf = JSON.parse(tx.riskFlagsJson ?? "[]") as unknown;
    riskFlags = Array.isArray(rf) ? rf.map(String) : [];
  } catch {
    riskFlags = [];
  }
  let citedRules: unknown[] = [];
  try {
    const cr = JSON.parse(tx.citedRulesJson ?? "[]") as unknown;
    citedRules = Array.isArray(cr) ? cr : [];
  } catch {
    citedRules = [];
  }
  let agentDecision: Record<string, unknown> | undefined;
  try {
    if (tx.agentDecisionJson) {
      agentDecision = JSON.parse(tx.agentDecisionJson) as Record<string, unknown>;
    }
  } catch {
    agentDecision = undefined;
  }

  return {
    id: tx.id,
    requestedAt: tx.createdAt.toISOString(),
    agentId: tx.agentId,
    agentName: tx.agent?.name ?? "Agent",
    walletId: tx.walletId,
    walletName: tx.wallet?.name ?? "Wallet",
    recipient: tx.recipient ?? undefined,
    vendor: tx.vendor ?? undefined,
    category: tx.category ?? undefined,
    amount: tx.amountCents / 100,
    currency: tx.currency,
    memo: tx.memo ?? undefined,
    purpose: tx.purpose ?? undefined,
    context,
    riskScore: tx.riskScore ?? undefined,
    riskFlags: riskFlags.length ? riskFlags : undefined,
    citedRules: citedRules.length ? citedRules : undefined,
    agentDecision,
    matchedPayee: tx.payee
      ? {
          id: tx.payee.id,
          displayName: tx.payee.displayName,
          defaultRail: tx.payee.defaultRail,
          paymentInstructions: tx.payee.paymentInstructions ?? undefined,
          stripeConnectAccountId: tx.payee.stripeConnectAccountId ?? undefined,
        }
      : undefined,
    status: tx.status,
    policyResult: tx.policyResult ?? undefined,
    reviewState: tx.reviewState ?? undefined,
    evidence,
    policyEvaluation,
    auditEvents,
    railType: tx.railType,
    sourceKind: tx.sourceKind,
    settledAt: tx.settledAt?.toISOString(),
    payoutStatus: tx.payoutStatus ?? undefined,
    payoutProvider: tx.payoutProvider ?? undefined,
    payoutExternalId: tx.payoutExternalId ?? undefined,
    payoutError: tx.payoutError ?? undefined,
    payoutAttemptedAt: tx.payoutAttemptedAt?.toISOString(),
  };
}
