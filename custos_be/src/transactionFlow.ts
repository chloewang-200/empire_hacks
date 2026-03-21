import { prisma } from "./prisma.js";
import { parseWalletPolicy, transactionToJson } from "./mappers.js";
import { evaluatePolicy, applySpendMode } from "./policy.js";
import { matchPayeeByVendor } from "./payeeMatcher.js";
import { executeAutomatedPayout } from "./payoutExecution.js";

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
  const amountCents = Math.round(body.amount * 100);
  const daily = await walletDailySpentCents(wallet.id);
  const hasEvidence = (body.evidence?.length ?? 0) > 0;
  const requestedPayoutRail =
    body.railType?.trim() || resolvedPayee?.defaultRail || "merchant_card";

  let outcome = evaluatePolicy({
    policy,
    amountCents,
    walletDailySpentCents: daily,
    vendor: body.vendor,
    category: body.category,
    hasEvidence,
    hasApprovedPayeeMatch,
    walletBalanceCents: wallet.balanceCents,
    requestedPayoutRail,
  });

  const ws = await prisma.workspace.findUnique({ where: { id: agent.workspaceId } });
  const spendMode = ws?.spendMode ?? "STRIPE_TEST";
  outcome = applySpendMode(spendMode, outcome);

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
      policyEvalJson: JSON.stringify(outcome.policyEvaluation),
      auditJson: JSON.stringify(audit),
    },
    include: { agent: true, wallet: true, payee: true },
  });

  let finalRow = tx;
  if (outcome.status === "approved" && policy.autoExecutePayout) {
    await executeAutomatedPayout({
      transactionId: tx.id,
      walletId: wallet.id,
      amountCents,
      currency: body.currency ?? "USD",
      railType: requestedPayoutRail,
      stripeConnectAccountId:
        body.stripeConnectAccountId?.trim() || resolvedPayee?.stripeConnectAccountId || null,
      venmoHandle: body.venmoHandle?.trim() || null,
    });
    finalRow = (await prisma.transaction.findFirst({
      where: { id: tx.id },
      include: { agent: true, wallet: true, payee: true },
    }))!;
  }

  return transactionToJson(finalRow);
}
