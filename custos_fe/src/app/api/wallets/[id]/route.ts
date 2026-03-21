import { NextResponse } from "next/server";
import type { Wallet } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wallet: Wallet = {
    id,
    name: "Placeholder Wallet",
    currency: "USD",
    balance: 0,
    policy: { approvalMode: "review", limits: {} },
    assignedAgentsCount: 0,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(wallet);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const wallet: Wallet = {
    id,
    name: body.name ?? "Placeholder Wallet",
    currency: body.currency ?? "USD",
    balance: body.balance ?? 0,
    policy: body.policy ?? { approvalMode: "review", limits: {} },
    assignedAgentsCount: body.assignedAgentsCount ?? 0,
    status: body.status ?? "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(wallet);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  return NextResponse.json({ ok: true });
}
