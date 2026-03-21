import { NextResponse } from "next/server";
import type { Wallet, PaginatedResponse } from "@/lib/types";

function placeholderWallets(): Wallet[] {
  return [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const data = placeholderWallets();
    const total = data.length;
    const start = (page - 1) * pageSize;
    const paginated = data.slice(start, start + pageSize);
    const body: PaginatedResponse<Wallet> = {
      data: paginated,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const wallet: Wallet = {
      id: `wal_${Date.now()}`,
      name: body.name ?? "New Wallet",
      currency: body.currency ?? "USD",
      balance: body.balance ?? body.policy?.limits?.daily ?? 0,
      policy: body.policy ?? {
        approvalMode: "review",
        limits: {},
      },
      assignedAgentsCount: 0,
      status: body.status ?? "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(wallet);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
