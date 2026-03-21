import { NextResponse } from "next/server";
import type { Transaction } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      requestedAt: new Date().toISOString(),
      agentId: body.agentId ?? "",
      agentName: body.agentName ?? "Agent",
      walletId: body.walletId ?? "",
      walletName: body.walletName ?? "Wallet",
      amount: body.amount ?? 0,
      currency: body.currency ?? "USD",
      recipient: body.recipient,
      vendor: body.vendor,
      category: body.category,
      memo: body.memo,
      status: "pending_review",
      policyResult: "within_policy",
      evidence: body.evidence,
    };
    return NextResponse.json(tx);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
