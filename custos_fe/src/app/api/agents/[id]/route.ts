import { NextResponse } from "next/server";
import type { Agent } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // TODO: Fetch from backend
  const agent: Agent = {
    id,
    name: "Placeholder Agent",
    description: "",
    templateType: "custom",
    assignedWalletId: "wal_1",
    role: "requester",
    capabilities: [],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(agent);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  // TODO: Update in backend
  const agent: Agent = {
    id,
    name: body.name ?? "Placeholder Agent",
    description: body.description,
    templateType: body.templateType ?? "custom",
    assignedWalletId: body.assignedWalletId ?? "wal_1",
    role: body.role ?? "requester",
    capabilities: body.capabilities ?? [],
    status: body.status ?? "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(agent);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  return NextResponse.json({ ok: true });
}
