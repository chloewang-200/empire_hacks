import { prisma } from "./prisma.js";
import { parseWalletPolicy, transactionToJson } from "./mappers.js";
import { evaluatePolicy, applySpendMode, type PolicyOutcome } from "./policy.js";
import type { WalletPolicy } from "./types.js";
import { matchPayeeByVendor } from "./payeeMatcher.js";
import { executeAutomatedPayout } from "./payoutExecution.js";
import {
  agentMonthSpentCents,
  evaluateAgentSpendGates,
  parseAgentSettings,
} from "./agentGovernance.js";
import {
  compileAuditPolicyText,
  evaluateInvoiceAudit,
  getAuditPolicyText,
} from "./auditPolicy.js";
import { applyTrustLayerToOutcome } from "./trustSignals.js";

function mergeAllowedPayoutRails(
  agentRails: string[],
  walletRails: string[] | undefined
): string[] | undefined {
  const w = walletRails?.filter(Boolean) ?? [];
  const a = agentRails.filter(Boolean);
  if (a.length && w.length) {
    const inter = a.filter((r) => w.includes(r));
    return inter.length ? inter : [];
  }
  if (a.length) return a;
  if (w.length) return w;
  return undefined;
}

function mergeRestrictedVendors(
  agentList: string[],
  walletList: string[] | undefined
): string[] | undefined {
  const u = [...new Set([...agentList, ...(walletList ?? [])])].filter(Boolean);
  return u.length ? u : undefined;
}

function mergeAllowedCategories(
  agentList: string[],
  walletList: string[] | undefined
): string[] | undefined {
  const w = walletList?.filter(Boolean) ?? [];
  const a = agentList.filter(Boolean);
  if (a.length && w.length) {
    const wl = new Set(w.map((x) => x.toLowerCase()));
    return a.filter((x) => wl.has(x.toLowerCase()));
  }
  if (a.length) return a;
  if (w.length) return w;
  return undefined;
}

function parseJsonObject<T = Record<string, unknown>>(value: string | null | undefined): T {
  try {
    const parsed = JSON.parse(value ?? "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return {} as T;
  } catch {
    return {} as T;
  }
}

function mergeWalletPolicyWithAgent(
  walletPolicy: WalletPolicy,
  agent: { requireApprovedPayee: boolean } & ReturnType<typeof parseAgentSettings>
): WalletPolicy {
  const lists = agent;
  return {
    ...walletPolicy,
    requireApprovedPayee:
      Boolean(walletPolicy.requireApprovedPayee) || Boolean(agent.requireApprovedPayee),
    allowedPayoutRails: mergeAllowedPayoutRails(
      lists.allowedPayoutRails,
      walletPolicy.allowedPayoutRails
    ),
    restrictedVendors: mergeRestrictedVendors(
      lists.restrictedVendors,
      walletPolicy.restrictedVendors
    ),
    allowedCategories: mergeAllowedCategories(
      lists.allowedCategories,
      walletPolicy.allowedCategories
    ),
  };
}

export type TransactionRequestInput = {
  agentId?: string;
  walletId?: string;
  amount: number;
  currency?: string;
  recipient?: string;
  vendor?: string;
  category?: string;
  memo?: string;
  purpose?: string;
  context?: Record<string, unknown>;
  payeeId?: string;
  railType?: string;
  sourceKind?: string;
  evidence?: unknown[];
  idempotencyKey?: string;
  /** Stripe Connect connected account id (acct_…) — overrides payee record */
  stripeConnectAccountId?: string;
  /** Optional Venmo @handle for audit when rail is venmo */
  venmoHandle?: string;
  riskScore?: number;
  riskFlags?: string[];
  citedRules?: { id: string; title: string; source?: string; excerpt?: string }[];
  agentDecision?: { summary: string; reasoning?: string; modelConfidence?: number };
};

async function walletDailySpentCents(walletId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const agg = await prisma.transaction.aggregate({
    where: {
      walletId,
      createdAt: { gte: start },
      status: { in: ["approved", "pending_review", "settled"] },
    },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

async function agentDaySpentCents(agentId: string): Promise<number> {
  const start = new Date();
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

/**
 * Core path for agent-initiated spend (API key or dashboard-as-user).
 */
export async function submitAgentTransactionRequest(
  agent: { id: string; workspaceId: string; walletId: string; name: string },
  body: TransactionRequestInput
): Promise<Record<string, unknown>> {
  const walletId = body.walletId ?? agent.walletId;
  if (walletId !== agent.walletId) {
    throw new Error("walletId must match agent wallet");
  }

  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, workspaceId: agent.workspaceId },
  });
  if (!wallet) throw new Error("Wallet not found");

  const payees = await prisma.approvedPayee.findMany({
    where: { workspaceId: agent.workspaceId, active: true },
  });

  let resolvedPayee = null as (typeof payees)[0] | null;
  let resolutionMethod: "explicit" | "vendor_match" | "none" = "none";

  const explicitPayeeId = body.payeeId?.trim();
  if (explicitPayeeId) {
    resolvedPayee = payees.find((p) => p.id === explicitPayeeId) ?? null;
    if (!resolvedPayee) throw new Error("Invalid payeeId for this workspace");
    resolutionMethod = "explicit";
  } else if (body.vendor?.trim()) {
    resolvedPayee = matchPayeeByVendor(payees, body.vendor);
    if (resolvedPayee) resolutionMethod = "vendor_match";
  }

  const hasApprovedPayeeMatch = resolvedPayee != null;
  const policy = parseWalletPolicy(wallet.policyJson);
  const fundingModel = wallet.fundingModel?.trim() || "prefund";
  const hasConnectChargePm = Boolean(
    wallet.stripeCustomerId && wallet.stripeDefaultPaymentMethodId
  );
  const amountCents = Math.round(body.amount * 100);
  const daily = await walletDailySpentCents(wallet.id);
  const hasEvidence = (body.evidence?.length ?? 0) > 0;
  const requestedPayoutRail =
    body.railType?.trim() || resolvedPayee?.defaultRail || "merchant_card";
  const requestContext =
    body.context && typeof body.context === "object" && !Array.isArray(body.context)
      ? body.context
      : undefined;
  const invoiceNumber =
    typeof requestContext?.invoiceNumber === "string" ? requestContext.invoiceNumber : undefined;
  const dueDate =
    typeof requestContext?.dueDate === "string" ? requestContext.dueDate : undefined;
  const extractionConfidenceFromContext =
    typeof requestContext?.extractionConfidence === "number"
      ? requestContext.extractionConfidence
      : undefined;
  const evidenceFirst = body.evidence?.[0];
  const evidenceObject =
    evidenceFirst && typeof evidenceFirst === "object" && !Array.isArray(evidenceFirst)
      ? (evidenceFirst as Record<string, unknown>)
      : undefined;
  const extractionConfidence =
    extractionConfidenceFromContext ??
    (typeof evidenceObject?.confidence === "number" ? evidenceObject.confidence : undefined) ??
    (typeof evidenceObject?.extractionConfidence === "number"
      ? evidenceObject.extractionConfidence
      : undefined);

  const fullAgent = await prisma.agent.findFirst({
    where: { id: agent.id, workspaceId: agent.workspaceId },
  });
  if (!fullAgent) throw new Error("Agent not found");

  const monthSpent = await agentMonthSpentCents(fullAgent.id);
  const daySpent = await agentDaySpentCents(fullAgent.id);
  const agentGate = evaluateAgentSpendGates(
    fullAgent,
    {
      amountCents,
      vendor: body.vendor,
      category: body.category,
      railType: requestedPayoutRail,
      hasApprovedPayeeMatch,
    },
    monthSpent,
    daySpent
  );

  const agentLists = parseAgentSettings(fullAgent);
  const auditPolicyText = getAuditPolicyText(agentLists.settings);
  const auditPolicy = compileAuditPolicyText(auditPolicyText);
  const mergedPolicy = mergeWalletPolicyWithAgent(policy, {
    requireApprovedPayee: fullAgent.requireApprovedPayee,
    ...agentLists,
  });

  let outcome: PolicyOutcome;
  if (agentGate.kind === "block" || agentGate.kind === "review") {
    outcome = agentGate.outcome;
  } else {
    outcome = evaluatePolicy({
      policy: mergedPolicy,
      amountCents,
      walletDailySpentCents: daily,
      vendor: body.vendor,
      category: body.category,
      hasEvidence,
      hasApprovedPayeeMatch,
      walletBalanceCents: wallet.balanceCents,
      requestedPayoutRail,
      walletFundingModel: fundingModel,
      hasConnectChargePaymentMethod:
        fundingModel === "connect_destination" ? hasConnectChargePm : undefined,
    });
    outcome = {
      ...outcome,
      policyEvaluation: [...agentGate.agentChecks, ...outcome.policyEvaluation],
    };
    if (
      agentGate.forceHumanReview &&
      outcome.status === "approved" &&
      outcome.policyResult === "within_policy"
    ) {
      outcome = {
        ...outcome,
        policyResult: "needs_manual_approval",
        status: "pending_review",
        reviewState: "pending",
      };
    }
  }

  const ws = await prisma.workspace.findUnique({ where: { id: agent.workspaceId } });
  const spendMode = ws?.spendMode ?? "STRIPE_TEST";
  outcome = applySpendMode(spendMode, outcome);
  outcome = applyTrustLayerToOutcome(outcome, {
    riskScore: body.riskScore,
    riskFlags: body.riskFlags,
    agentDecision: body.agentDecision,
    citedRules: body.citedRules,
    evidence: body.evidence,
  });

  const isInvoiceRequest =
    body.sourceKind === "invoice_upload" ||
    body.sourceKind === "invoice_chat" ||
    fullAgent.templateType === "invoice" ||
    fullAgent.templateType === "invoice_chat";
  let invoiceAudit:
    | {
        checks: { check: string; result: "pass" | "fail"; detail?: string }[];
        reviewRequired: boolean;
      }
    | null = null;
  if (isInvoiceRequest && auditPolicy.enabled) {
    const recentInvoicesRaw = await prisma.transaction.findMany({
      where: {
        workspaceId: agent.workspaceId,
        sourceKind: { in: ["invoice_upload", "invoice_chat"] },
        createdAt: { lt: new Date() },
      },
      select: {
        vendor: true,
        amountCents: true,
        contextJson: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    const recentInvoices = recentInvoicesRaw.map((row) => {
      const context = parseJsonObject<Record<string, unknown>>(row.contextJson);
      return {
        vendor: row.vendor ?? undefined,
        amountCents: row.amountCents,
        invoiceNumber:
          typeof context.invoiceNumber === "string" ? context.invoiceNumber : undefined,
      };
    });

    invoiceAudit = evaluateInvoiceAudit({
      auditPolicy,
      vendor: body.vendor,
      amountCents,
      invoiceNumber,
      dueDate,
      extractionConfidence,
      requestedPayoutRail,
      matchedPayeeName: resolvedPayee?.displayName ?? undefined,
      matchedPayeeRail: resolvedPayee?.defaultRail ?? undefined,
      hasEvidence,
      citedRulesCount: body.citedRules?.length ?? 0,
      recentInvoices,
    });

    outcome = {
      ...outcome,
      policyEvaluation: [...outcome.policyEvaluation, ...invoiceAudit.checks],
    };
    if (
      invoiceAudit.reviewRequired &&
      outcome.status === "approved" &&
      outcome.policyResult === "within_policy"
    ) {
      outcome = {
        ...outcome,
        policyResult: "needs_manual_approval",
        status: "pending_review",
        reviewState: "pending",
      };
    }
  }

  if (body.idempotencyKey) {
    const existing = await prisma.transaction.findFirst({
      where: {
        workspaceId: agent.workspaceId,
        idempotencyKey: body.idempotencyKey,
      },
      include: { agent: true, wallet: true, payee: true },
    });
    if (existing) return transactionToJson(existing);
  }

  const ts = new Date().toISOString();
  const audit: object[] = [];
  let seq = 1;
  audit.push({
    id: String(seq++),
    timestamp: ts,
    type: "request",
    action: "Spend request received",
    actor: agent.name,
    detail: body.purpose?.trim() || "No purpose provided by agent",
  });
  if (body.context && Object.keys(body.context).length > 0) {
    audit.push({
      id: String(seq++),
      timestamp: ts,
      type: "agent_context",
      action: "Structured context from agent",
      detail: JSON.stringify(body.context),
    });
  }
  audit.push({
    id: String(seq++),
    timestamp: ts,
    type: "payee_resolution",
    action:
      resolutionMethod === "none"
        ? "No approved payee matched"
        : `Payee resolved (${resolutionMethod})`,
    detail: resolvedPayee
      ? `${resolvedPayee.displayName} (${resolvedPayee.id})`
      : body.vendor?.trim() || "—",
  });
  if (hasEvidence) {
    audit.push({
      id: String(seq++),
      timestamp: ts,
      type: "evidence",
      action: "Proof of work / attachments",
      detail: `${body.evidence!.length} item(s) (e.g. invoice file IDs, URLs)`,
    });
  }
  if (body.agentDecision?.summary?.trim()) {
    audit.push({
      id: String(seq++),
      timestamp: ts,
      type: "agent_decision",
      action: "Agent decision (CoT / rationale)",
      actor: agent.name,
      detail: JSON.stringify({
        summary: body.agentDecision.summary,
        reasoning: body.agentDecision.reasoning,
        modelConfidence: body.agentDecision.modelConfidence,
      }),
    });
  }
  if (body.citedRules?.length) {
    audit.push({
      id: String(seq++),
      timestamp: ts,
      type: "citations",
      action: "Cited rules / sources",
      detail: JSON.stringify(body.citedRules),
    });
  }
  if (invoiceAudit) {
    audit.push({
      id: String(seq++),
      timestamp: ts,
      type: "invoice_auditor",
      action: invoiceAudit.reviewRequired ? "Invoice auditor escalated" : "Invoice auditor pass",
      actor: "invoice auditor",
      detail: JSON.stringify({
        policyText: auditPolicyText,
        checks: invoiceAudit.checks,
      }),
    });
  }
  if (body.riskScore != null || (body.riskFlags?.length ?? 0) > 0) {
    audit.push({
      id: String(seq++),
      timestamp: ts,
      type: "risk",
      action: "Risk score & flags",
      detail: JSON.stringify({ riskScore: body.riskScore ?? null, riskFlags: body.riskFlags ?? [] }),
    });
  }
  audit.push({
    id: String(seq++),
    timestamp: ts,
    type: "policy",
    action: `Policy outcome: ${outcome.policyResult}`,
    actor: "policy engine",
    detail:
      outcome.status === "pending_review"
        ? "Raised for human review or manual ops (see policy checks)"
        : outcome.status === "blocked"
          ? "Blocked — see policy checks"
          : "Passed automated policy gates",
  });

  const tx = await prisma.transaction.create({
    data: {
      workspaceId: agent.workspaceId,
      walletId: wallet.id,
      agentId: agent.id,
      amountCents,
      currency: body.currency ?? "USD",
      railType: requestedPayoutRail,
      sourceKind: body.sourceKind ?? "api",
      status: outcome.status,
      policyResult: outcome.policyResult,
      reviewState: outcome.reviewState ?? undefined,
      recipient: body.recipient,
      vendor: body.vendor,
      category: body.category,
      memo: body.memo,
      purpose: body.purpose?.trim() || undefined,
      contextJson:
        body.context && Object.keys(body.context).length > 0 ? JSON.stringify(body.context) : undefined,
      payeeId: resolvedPayee?.id,
      idempotencyKey: body.idempotencyKey,
      evidenceJson: JSON.stringify(body.evidence ?? []),
      riskScore: body.riskScore ?? undefined,
      riskFlagsJson: JSON.stringify(body.riskFlags ?? []),
      citedRulesJson: JSON.stringify(body.citedRules ?? []),
      agentDecisionJson: body.agentDecision ? JSON.stringify(body.agentDecision) : undefined,
      policyEvalJson: JSON.stringify(outcome.policyEvaluation),
      auditJson: JSON.stringify(audit),
    },
    include: { agent: true, wallet: true, payee: true },
  });

  let finalRow = tx;
  if (outcome.status === "approved" && mergedPolicy.autoExecutePayout) {
    await executeAutomatedPayout({
      transactionId: tx.id,
      walletId: wallet.id,
      amountCents,
      currency: body.currency ?? "USD",
      railType: requestedPayoutRail,
      stripeConnectAccountId:
        body.stripeConnectAccountId?.trim() || resolvedPayee?.stripeConnectAccountId || null,
      venmoHandle: body.venmoHandle?.trim() || null,
      fundingModel,
      stripeCustomerId: wallet.stripeCustomerId,
      stripeDefaultPaymentMethodId: wallet.stripeDefaultPaymentMethodId,
    });
    finalRow = (await prisma.transaction.findFirst({
      where: { id: tx.id },
      include: { agent: true, wallet: true, payee: true },
    }))!;
  }

  return transactionToJson(finalRow);
}
