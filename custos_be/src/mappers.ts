import type { Agent as PrismaAgent, Transaction as PrismaTransaction, Wallet as PrismaWallet } from "@prisma/client";
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
    policy: parseWalletPolicy(w.policyJson),
    assignedAgentsCount: count,
    status: w.status,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

export function agentToJson(
  a: PrismaAgent & { wallet?: { name: string } }
): Record<string, unknown> {
  let capabilities: { id: string; name: string }[] = [];
  try {
    const caps = JSON.parse(a.capabilitiesJson) as string[];
    capabilities = caps.map((c) => ({ id: c, name: c }));
  } catch {
    capabilities = [];
  }
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
  };
}

export function transactionToJson(
  tx: PrismaTransaction & { agent?: { name: string }; wallet?: { name: string } }
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
    status: tx.status,
    policyResult: tx.policyResult ?? undefined,
    reviewState: tx.reviewState ?? undefined,
    evidence,
    policyEvaluation,
    auditEvents,
    railType: tx.railType,
    sourceKind: tx.sourceKind,
    settledAt: tx.settledAt?.toISOString(),
  };
}
