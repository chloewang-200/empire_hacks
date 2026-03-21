import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Server-only: upsert user in custos_be and return Custos JWT for browser API calls.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const base =
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }
  const secret = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";
  const r = await fetch(`${base}/api/internal/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": secret,
    },
    body: JSON.stringify({
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    }),
  });
  if (!r.ok) {
    const msg = await r.text();
    return NextResponse.json({ message: msg || r.statusText }, { status: 502 });
  }
  const data = (await r.json()) as { token: string; userId: string; workspaceId: string };
  return NextResponse.json(data);
}
