import { NextResponse } from "next/server";
import type { Agent, PaginatedResponse } from "@/lib/types";

// TODO: Replace with real DB/backend. Placeholder for local dev.
function placeholderAgents(): Agent[] {
  return [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const data = placeholderAgents();
    const total = data.length;
    const start = (page - 1) * pageSize;
    const paginated = data.slice(start, start + pageSize);
    const body: PaginatedResponse<Agent> = {
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
    // TODO: Validate body and persist via backend
    const agent: Agent = {
      id: `agt_${Date.now()}`,
      name: body.name ?? "New Agent",
      description: body.description,
      templateType: body.templateType ?? "custom",
      assignedWalletId: body.assignedWalletId ?? "",
      role: body.role ?? "requester",
      capabilities: [],
      status: body.status ?? "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json(agent);
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
