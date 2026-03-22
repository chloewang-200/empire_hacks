import { NextResponse } from "next/server";

function getBaseUrl() {
  return (
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  );
}

async function proxyTransaction(request: Request, id: string, method: "GET" | "PATCH") {
  const base = getBaseUrl();
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const secret = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";
  const authEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";
  const upstreamPath =
    authHeader || authEnabled ? `/api/transactions/${id}` : `/api/admin/transactions/${id}`;

  let response: Response;
  try {
    response = await fetch(`${base}${upstreamPath}`, {
      method,
      headers: authHeader
        ? {
            "Content-Type": "application/json",
            Authorization: authHeader,
          }
        : {
            "Content-Type": "application/json",
            "X-Internal-Secret": secret,
          },
      body: method === "GET" ? undefined : await request.text(),
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

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json({ message: text || response.statusText }, { status: response.status });
  }

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyTransaction(request, id, "GET");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyTransaction(request, id, "PATCH");
}
