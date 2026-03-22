import { NextResponse } from "next/server";
import type { ReviewItem, Transaction } from "@/lib/types";

function getBaseUrl() {
  return (
    process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "")
  );
}

function deriveFlaggedReason(transaction: Transaction) {
  if (transaction.policyResult) return transaction.policyResult.replace(/_/g, " ");
  if (transaction.riskFlags?.length) return transaction.riskFlags[0].replace(/_/g, " ");
  return "pending review";
}

export async function GET(request: Request) {
  const base = getBaseUrl();
  if (!base) {
    return NextResponse.json(
      { message: "Set CUSTOS_API_URL or NEXT_PUBLIC_API_URL to your custos_be URL" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  const secret = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";
  const url = new URL(request.url);
  const qs = url.search || "";
  const authEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

  if (authHeader || authEnabled) {
    let response: Response;
    try {
      response = await fetch(`${base}/api/review-queue${qs}`, {
        method: "GET",
        headers: authHeader ? { Authorization: authHeader } : {},
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

  let adminResponse: Response;
  try {
    adminResponse = await fetch(`${base}/api/admin/transactions?status=pending_review${qs ? `&${qs.slice(1)}` : ""}`, {
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

  const text = await adminResponse.text();
  if (!adminResponse.ok) {
    return NextResponse.json({ message: text || adminResponse.statusText }, { status: adminResponse.status });
  }

  const parsed = JSON.parse(text) as {
    data: Transaction[];
    total: number;
  };
  const now = Date.now();
  const data: ReviewItem[] = parsed.data.map((transaction) => ({
    transactionId: transaction.id,
    transaction,
    flaggedReason: deriveFlaggedReason(transaction),
    ageMinutes: Math.floor((now - new Date(transaction.requestedAt).getTime()) / 60000),
    reviewerStatus: "pending",
  }));

  return NextResponse.json({ data, total: parsed.total });
}
