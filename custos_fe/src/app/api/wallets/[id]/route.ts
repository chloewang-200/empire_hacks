import { NextResponse } from "next/server";
import type { Wallet } from "@/lib/types";

function backendBase(): string | null {
  const base =
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  return base || null;
}

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
    balance: 0,
    policy: body.policy ?? { approvalMode: "review", limits: {} },
    assignedAgentsCount: body.assignedAgentsCount ?? 0,
    status: body.status ?? "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(wallet);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }
  const auth = request.headers.get("authorization");
  let r: Response;
  try {
    r = await fetch(`${base}/api/wallets/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: auth ? { Authorization: auth } : {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cannot reach custos_be";
    return NextResponse.json({ message }, { status: 503 });
  }
  const text = await r.text();
  if (!r.ok) {
    try {
      const j = JSON.parse(text) as { message?: string };
      return NextResponse.json({ message: j.message ?? r.statusText }, { status: r.status });
    } catch {
      return NextResponse.json({ message: text || r.statusText }, { status: r.status });
    }
  }
  try {
    return NextResponse.json(text ? JSON.parse(text) : { ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
