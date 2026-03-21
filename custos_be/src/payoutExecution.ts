import { prisma } from "./prisma.js";
import { stripe, stripeEnabled } from "./stripe.js";

/**
 * After a transaction is policy-approved with wallet.autoExecutePayout, attempt real movement of funds.
 *
 * - **Stripe Connect**: `stripe.transfers.create` to `acct_…` (requires platform balance + Connect setup).
 * - **Venmo**: no supported send API in this stack — marked `unsupported_rail` for manual follow-up.
 *
 * Wallet balance is decremented only after a successful Stripe transfer.
 */
export async function executeAutomatedPayout(opts: {
  transactionId: string;
  walletId: string;
  amountCents: number;
  currency: string;
  railType: string;
  stripeConnectAccountId?: string | null;
  venmoHandle?: string | null;
}): Promise<void> {
  const { transactionId, walletId, amountCents, currency, railType } = opts;
  const stripeDest = opts.stripeConnectAccountId?.trim() || null;
  const rail = railType.toLowerCase();

  async function pushAudit(entry: Record<string, unknown>) {
    const row = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!row) return;
    const audit = JSON.parse(row.auditJson ?? "[]") as object[];
    audit.push({
      id: String(audit.length + 1),
      timestamp: new Date().toISOString(),
      ...entry,
    });
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { auditJson: JSON.stringify(audit) },
    });
  }

  if (rail === "venmo_p2p" || rail === "venmo") {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        payoutStatus: "unsupported_rail",
        payoutProvider: "venmo",
        payoutError:
          "Venmo is not available as an automated payout in this build. Use PayPal Payouts, a card/ACH processor, or pay manually; see payment instructions on the payee.",
        payoutAttemptedAt: new Date(),
      },
    });
    await pushAudit({
      type: "payout",
      action: "Automated payout not executed",
      detail: `Venmo handle hint: ${opts.venmoHandle ?? "—"} — operator payout required`,
    });
    return;
  }

  const canTryStripe =
    Boolean(stripeDest) &&
    stripeEnabled() &&
    stripe &&
    (rail === "stripe_connect" || rail === "merchant_card");

  if (!canTryStripe) {
    const reason = !stripeDest
      ? "No Stripe Connect account id — set on payee or pass stripeConnectAccountId on the payment API"
      : !stripeEnabled()
        ? "Stripe not configured (STRIPE_SECRET_KEY)"
        : `Rail "${railType}" is not wired for Stripe Transfer (use railType stripe_connect or merchant_card with acct_…)`;
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        payoutStatus: "skipped",
        payoutProvider: "none",
        payoutError: reason,
        payoutAttemptedAt: new Date(),
      },
    });
    await pushAudit({
      type: "payout",
      action: "Automated payout skipped",
      detail: reason,
    });
    return;
  }

  try {
    const transfer = await stripe!.transfers.create(
      {
        amount: amountCents,
        currency: currency.toLowerCase(),
        destination: stripeDest!,
        metadata: {
          custos_transaction_id: transactionId,
          custos_wallet_id: walletId,
        },
      },
      { idempotencyKey: `custos_payout_${transactionId}`.slice(0, 255) }
    );

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: walletId },
        data: { balanceCents: { decrement: amountCents } },
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "settled",
          settledAt: new Date(),
          payoutStatus: "succeeded",
          payoutProvider: "stripe_transfer",
          payoutExternalId: transfer.id,
          payoutError: null,
          payoutAttemptedAt: new Date(),
        },
      }),
    ]);

    await pushAudit({
      type: "payout",
      action: "Stripe Transfer completed",
      actor: "stripe",
      detail: transfer.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        payoutStatus: "failed",
        payoutProvider: "stripe_transfer",
        payoutError: msg.slice(0, 2000),
        payoutAttemptedAt: new Date(),
      },
    });
    await pushAudit({
      type: "payout",
      action: "Stripe Transfer failed",
      actor: "stripe",
      detail: msg.slice(0, 800),
    });
  }
}
