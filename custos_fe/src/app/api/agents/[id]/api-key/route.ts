import { NextResponse } from "next/server";
import type { ApiKeyResponse } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  // TODO: Generate key server-side and return once. Never store full key in DB.
  const response: ApiKeyResponse = {
    keyPrefix: "custos_****",
    fullKey: `custos_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
