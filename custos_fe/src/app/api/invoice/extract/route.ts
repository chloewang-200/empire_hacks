import { NextResponse } from "next/server";

function backendBase(): string | null {
  const base =
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  return base || null;
}

/** Proxies extract to custos_be (OCR via CUSTOS_INVOICE_AGENT_URL or mock). */
export async function POST(request: Request) {
  const base = backendBase();
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }
  const auth = request.headers.get("authorization");
  const body = await request.text();
  let r: Response;
  try {
    r = await fetch(`${base}/api/invoice/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body,
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
  return new NextResponse(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
