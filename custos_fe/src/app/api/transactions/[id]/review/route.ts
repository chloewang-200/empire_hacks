import { NextResponse } from "next/server";
import type { Transaction } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const decision = body?.decision === "approve" ? "approved" : "blocked";
  const tx: Transaction = {
    id,
    requestedAt: new Date().toISOString(),
    agentId: "agt_1",
    agentName: "Invoice Agent",
    walletId: "wal_1",
    walletName: "Operations Wallet",
    amount: 0,
    currency: "USD",
    status: decision,
    policyResult: "within_policy",
  };
  return NextResponse.json(tx);
}
