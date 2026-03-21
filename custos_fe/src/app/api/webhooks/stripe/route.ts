import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe webhooks must use the raw body for signature verification.
 * Configure endpoint URL in Stripe Dashboard (or `stripe listen` for local dev).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    return NextResponse.json({ message: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const stripe = new Stripe(secret);
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ message: "No signature" }, { status: 400 });
  }

  const buf = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, whSecret);
  } catch {
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const walletId = pi.metadata?.walletId;
    const workspaceId = pi.metadata?.workspaceId;
    if (!walletId || !workspaceId) {
      return NextResponse.json({ message: "PaymentIntent missing wallet metadata" }, { status: 400 });
    }
    const amountCents = pi.amount_received ?? pi.amount;
    const base =
      process.env.CUSTOS_API_URL?.replace(/\/$/, "") ??
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    const internal = process.env.CUSTOS_INTERNAL_SECRET ?? "internal-dev-secret";
    if (!base) {
      return NextResponse.json({ message: "CUSTOS_API_URL not set" }, { status: 500 });
    }
    const r = await fetch(`${base}/api/internal/stripe-credit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internal,
      },
      body: JSON.stringify({
        paymentIntentId: pi.id,
        walletId,
        workspaceId,
        amountCents,
        currency: pi.currency,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ message: t || "Backend credit failed" }, { status: 502 });
    }
  }

  return NextResponse.json({ received: true });
}
