import { NextResponse } from "next/server";

function getBaseUrl() {
  return (
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  );
}

async function proxy(request: Request, slug: string[]) {
  const base = getBaseUrl();
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }

  const secret = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";
  const url = new URL(request.url);
  const qs = url.search || "";
  const upstream = `${base}/api/admin/${slug.join("/")}${qs}`;

  let r: Response;
  try {
    r = await fetch(upstream, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: request.method === "GET" ? undefined : await request.text(),
    });
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
    return NextResponse.json(
      {
        message: `Cannot reach custos_be at ${base}. Start the API server (e.g. npm run dev in custos_be).`,
        ...(cause ? { cause } : {}),
      },
      { status: 503 }
    );
  }

  const text = await r.text();
  if (!r.ok) {
    return NextResponse.json({ message: text || r.statusText }, { status: 502 });
  }

  return new NextResponse(text, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  return proxy(request, slug);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  return proxy(request, slug);
}
