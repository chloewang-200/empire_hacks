import { NextResponse } from "next/server";
import type { Transaction } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tx: Transaction = {
    id,
    requestedAt: new Date().toISOString(),
    agentId: "agt_1",
    agentName: "Invoice Agent",
    walletId: "wal_1",
    walletName: "Operations Wallet",
    amount: 1250,
    currency: "USD",
    status: "pending_review",
    policyResult: "within_policy",
    policyEvaluation: [
      { check: "Amount within per-transaction limit", result: "pass" },
      { check: "Daily spend remaining", result: "pass" },
      { check: "Category allowed", result: "pass" },
      { check: "Vendor allowed", result: "pass" },
      { check: "Supporting evidence attached", result: "pass" },
    ],
    auditEvents: [
      { id: "1", timestamp: new Date().toISOString(), action: "Transaction requested by agent" },
      { id: "2", timestamp: new Date().toISOString(), action: "Evidence attached" },
      { id: "3", timestamp: new Date().toISOString(), action: "Policy evaluation completed" },
    ],
  };
  return NextResponse.json(tx);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const tx: Transaction = {
    id,
    requestedAt: new Date().toISOString(),
    agentId: "agt_1",
    agentName: "Invoice Agent",
    walletId: "wal_1",
    walletName: "Operations Wallet",
    amount: 0,
    currency: "USD",
    status: body.status ?? "pending_review",
    policyResult: "within_policy",
  };
  return NextResponse.json(tx);
}
