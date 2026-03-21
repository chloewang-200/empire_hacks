import { NextResponse } from "next/server";
import type { Wallet } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const amount = Number(body?.amount) || 0;
  // TODO: Integrate real funding rails; this is testing-mode behavior
  const wallet: Wallet = {
    id,
    name: "Placeholder Wallet",
    currency: "USD",
    balance: amount,
    policy: { approvalMode: "review", limits: {} },
    assignedAgentsCount: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(wallet);
}
