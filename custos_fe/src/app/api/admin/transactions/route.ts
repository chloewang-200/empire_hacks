import { NextResponse } from "next/server";

/**
 * Admin proxy: forwards to custos_be /api/admin/transactions using the internal secret.
 */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const qs = url.search ? url.search : "";

  let r: Response;
  try {
    r = await fetch(`${base}/api/admin/transactions${qs}`, {
      method: "GET",
      headers: {
        "X-Internal-Secret": secret,
      },
    });
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
    return NextResponse.json(
      {
        message:
          `Cannot reach custos_be at ${base}. Start the API server (e.g. npm run dev in custos_be).`,
        ...(cause ? { cause } : {}),
      },
      { status: 503 }
    );
  }

  if (!r.ok) {
    const msg = await r.text();
    return NextResponse.json({ message: msg || r.statusText }, { status: 502 });
  }

  const data = await r.json();
  return NextResponse.json(data);
}
