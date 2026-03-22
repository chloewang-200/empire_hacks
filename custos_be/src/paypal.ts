/**
 * PayPal Payouts API (sandbox or live) for Venmo recipients.
 * @see https://developer.paypal.com/docs/payouts/standard/payouts-to-venmo/
 */

const sandboxBase = "https://api-m.sandbox.paypal.com";
const liveBase = "https://api-m.paypal.com";

function apiBase(): string {
  return process.env.PAYPAL_SANDBOX === "false" ? liveBase : sandboxBase;
}

let cachedToken: { token: string; expiresAtMs: number } | null = null;

export function paypalPayoutsEnabled(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()
  );
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.token;
  }
  const id = process.env.PAYPAL_CLIENT_ID!.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET!.trim();
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const r = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`PayPal OAuth failed (${r.status}): ${text.slice(0, 1500)}`);
  }
  const j = JSON.parse(text) as { access_token: string; expires_in: number };
  cachedToken = {
    token: j.access_token,
    expiresAtMs: now + (j.expires_in ?? 3600) * 1000,
  };
  return j.access_token;
}

export type VenmoRecipient =
  | { recipient_type: "USER_HANDLE"; receiver: string }
  | { recipient_type: "EMAIL"; receiver: string }
  | { recipient_type: "PHONE"; receiver: string };

/** Infer PayPal recipient_type from a single string (handle, email, or US-style phone). */
export function parseVenmoReceiver(raw: string): VenmoRecipient | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return { recipient_type: "EMAIL", receiver: t };
  }
  const digits = t.replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && !/[a-zA-Z]/.test(t)) {
    const e164 =
      digits.length === 11 && digits.startsWith("1")
        ? `+${digits}`
        : digits.length === 10
          ? `+1${digits}`
          : `+${digits}`;
    return { recipient_type: "PHONE", receiver: e164 };
  }
  return { recipient_type: "USER_HANDLE", receiver: t.replace(/^@/, "") };
}

type CreatePayoutResult = {
  payoutBatchId: string;
  batchStatus: string;
};

export async function createVenmoPayout(opts: {
  amountCents: number;
  currency: string;
  senderBatchId: string;
  senderItemId: string;
  note: string;
  recipient: VenmoRecipient;
  idempotencyKey: string;
}): Promise<CreatePayoutResult> {
  if (opts.currency.toUpperCase() !== "USD") {
    throw new Error("PayPal Venmo payouts support USD only");
  }
  const token = await getAccessToken();
  const value = (opts.amountCents / 100).toFixed(2);
  const body = {
    sender_batch_header: {
      sender_batch_id: opts.senderBatchId.slice(0, 50),
      email_subject: "You have a payment",
    },
    items: [
      {
        recipient_type: opts.recipient.recipient_type,
        receiver: opts.recipient.receiver,
        amount: { value, currency: "USD" },
        note: opts.note.slice(0, 400),
        sender_item_id: opts.senderItemId.slice(0, 50),
        recipient_wallet: "Venmo",
      },
    ],
  };

  const r = await fetch(`${apiBase()}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": opts.idempotencyKey.slice(0, 36),
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`PayPal payout failed (${r.status}): ${text.slice(0, 2000)}`);
  }
  const j = JSON.parse(text) as {
    batch_header?: { payout_batch_id?: string; batch_status?: string };
  };
  return {
    payoutBatchId: j.batch_header?.payout_batch_id ?? "",
    batchStatus: j.batch_header?.batch_status ?? "UNKNOWN",
  };
}

export async function getPayoutBatchStatus(payoutBatchId: string): Promise<string> {
  const token = await getAccessToken();
  const r = await fetch(`${apiBase()}/v1/payments/payouts/${payoutBatchId}?total_required=false`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`PayPal get payout batch failed (${r.status}): ${text.slice(0, 1000)}`);
  }
  const j = JSON.parse(text) as { batch_header?: { batch_status?: string } };
  return j.batch_header?.batch_status ?? "UNKNOWN";
}

const TERMINAL_OK = new Set(["SUCCESS"]);
const TERMINAL_FAIL = new Set(["DENIED", "CANCELED"]);

/**
 * Poll until batch reaches a terminal state or timeout (sandbox batches often complete quickly).
 */
export async function waitForPayoutBatchSuccess(
  payoutBatchId: string,
  opts: { maxWaitMs?: number; intervalMs?: number } = {}
): Promise<{ status: string; ok: boolean }> {
  const maxWait = opts.maxWaitMs ?? 15_000;
  const interval = opts.intervalMs ?? 750;
  const deadline = Date.now() + maxWait;
  let last = "UNKNOWN";
  while (Date.now() < deadline) {
    last = await getPayoutBatchStatus(payoutBatchId);
    if (TERMINAL_OK.has(last)) return { status: last, ok: true };
    if (TERMINAL_FAIL.has(last)) return { status: last, ok: false };
    await new Promise((res) => setTimeout(res, interval));
  }
  return { status: last, ok: false };
}
