import type Stripe from "stripe";
import { prisma } from "./prisma.js";
import {
  createVenmoPayout,
  parseVenmoReceiver,
  paypalPayoutsEnabled,
  waitForPayoutBatchSuccess,
} from "./paypal.js";
import { stripe, stripeEnabled } from "./stripe.js";

/**
 * After a transaction is policy-approved with wallet.autoExecutePayout, attempt real movement of funds.
 *
 * - **Prefund + Stripe Connect**: `stripe.transfers.create` to `acct_…` (platform available balance).
 * - **Connect destination** (`fundingModel === connect_destination`): charge the wallet's saved
 *   PaymentMethod with `payment_intents` + `transfer_data.destination` (no ledger debit).
 * - **Venmo**: PayPal Payouts when configured; ledger debit skipped when `connect_destination` (card-on-file mode).
 */
export async function executeAutomatedPayout(opts: {
  transactionId: string;
  walletId: string;
  amountCents: number;
  currency: string;
  railType: string;
  stripeConnectAccountId?: string | null;
  venmoHandle?: string | null;
  fundingModel?: string | null;
  stripeCustomerId?: string | null;
  stripeDefaultPaymentMethodId?: string | null;
}): Promise<void> {
  const { transactionId, walletId, amountCents, currency, railType } = opts;
  const stripeDest = opts.stripeConnectAccountId?.trim() || null;
  const rail = railType.toLowerCase();
  const fundingModel = opts.fundingModel?.trim() || "prefund";
  const skipLedgerDecrement = fundingModel === "connect_destination";
  const stripeCustomerId = opts.stripeCustomerId?.trim() || null;
  const stripePmId = opts.stripeDefaultPaymentMethodId?.trim() || null;

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
    const hint = opts.venmoHandle?.trim() || null;
    const recipient = hint ? parseVenmoReceiver(hint) : null;

    if (paypalPayoutsEnabled() && recipient) {
      try {
        const currency = (opts.currency || "USD").toUpperCase();
        if (currency !== "USD") {
          throw new Error("Venmo payouts require USD");
        }
        const { payoutBatchId, batchStatus } = await createVenmoPayout({
          amountCents,
          currency,
          senderBatchId: `custos_${transactionId}`.slice(0, 50),
          senderItemId: transactionId.slice(0, 50),
          note: `Custos ${transactionId}`,
          recipient,
          idempotencyKey: `custos_payout_${transactionId}`,
        });
        await pushAudit({
          type: "payout",
          action: "PayPal Venmo batch created",
          actor: "paypal",
          detail: `${payoutBatchId} initial=${batchStatus}`,
        });

        const waited = await waitForPayoutBatchSuccess(payoutBatchId, {
          maxWaitMs: parseInt(process.env.PAYPAL_PAYOUT_POLL_MS ?? "20000", 10) || 20000,
        });

        if (waited.ok) {
          const settleData = {
            status: "settled" as const,
            settledAt: new Date(),
            payoutStatus: "succeeded" as const,
            payoutProvider: "paypal_venmo",
            payoutExternalId: payoutBatchId,
            payoutError: null,
            payoutAttemptedAt: new Date(),
          };
          if (skipLedgerDecrement) {
            await prisma.transaction.update({
              where: { id: transactionId },
              data: settleData,
            });
          } else {
            await prisma.$transaction([
              prisma.wallet.update({
                where: { id: walletId },
                data: { balanceCents: { decrement: amountCents } },
              }),
              prisma.transaction.update({
                where: { id: transactionId },
                data: settleData,
              }),
            ]);
          }
          await pushAudit({
            type: "payout",
            action: "PayPal Venmo payout succeeded",
            actor: "paypal",
            detail: payoutBatchId,
          });
        } else {
          await prisma.transaction.update({
            where: { id: transactionId },
            data: {
              payoutStatus: "processing",
              payoutProvider: "paypal_venmo",
              payoutExternalId: payoutBatchId,
              payoutError: `Batch did not reach SUCCESS within poll window (last status: ${waited.status}). Check PayPal dashboard; wallet not debited.`,
              payoutAttemptedAt: new Date(),
            },
          });
          await pushAudit({
            type: "payout",
            action: "PayPal Venmo batch pending or failed",
            actor: "paypal",
            detail: `batch=${payoutBatchId} status=${waited.status}`,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            payoutStatus: "failed",
            payoutProvider: "paypal_venmo",
            payoutError: msg.slice(0, 2000),
            payoutAttemptedAt: new Date(),
          },
        });
        await pushAudit({
          type: "payout",
          action: "PayPal Venmo payout failed",
          actor: "paypal",
          detail: msg.slice(0, 800),
        });
      }
      return;
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        payoutStatus: "unsupported_rail",
        payoutProvider: "venmo",
        payoutError: paypalPayoutsEnabled()
          ? "Venmo payout needs a recipient: pass venmoHandle (Venmo @username, email, or US phone)."
          : "Venmo auto-payout disabled: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox), or pay manually.",
        payoutAttemptedAt: new Date(),
      },
    });
    await pushAudit({
      type: "payout",
      action: "Automated payout not executed",
      detail: `Venmo hint: ${hint ?? "—"} — ${paypalPayoutsEnabled() ? "missing parseable recipient" : "PayPal not configured"}`,
    });
    return;
  }

  const stripeRailOk = rail === "stripe_connect" || rail === "merchant_card";

  if (
    fundingModel === "connect_destination" &&
    stripeRailOk &&
    Boolean(stripeDest) &&
    stripeEnabled() &&
    stripe
  ) {
    if (!stripeCustomerId || !stripePmId) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          payoutStatus: "failed",
          payoutProvider: "stripe_connect_destination",
          payoutError:
            "Wallet is missing Stripe customer or default payment method — complete card setup on the wallet.",
          payoutAttemptedAt: new Date(),
        },
      });
      await pushAudit({
        type: "payout",
        action: "Connect destination charge skipped",
        actor: "stripe",
        detail: "No customer or default payment_method on wallet",
      });
      return;
    }

    const feeRaw = parseInt(process.env.CUSTOS_STRIPE_APPLICATION_FEE_CENTS ?? "0", 10);
    const applicationFeeCents = Number.isFinite(feeRaw) && feeRaw > 0 ? feeRaw : 0;
    if (applicationFeeCents >= amountCents) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          payoutStatus: "failed",
          payoutProvider: "stripe_connect_destination",
          payoutError: "CUSTOS_STRIPE_APPLICATION_FEE_CENTS must be less than the payout amount",
          payoutAttemptedAt: new Date(),
        },
      });
      return;
    }

    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: currency.toLowerCase(),
      customer: stripeCustomerId,
      payment_method: stripePmId,
      off_session: true,
      confirm: true,
      metadata: {
        custos_transaction_id: transactionId,
        custos_wallet_id: walletId,
      },
      transfer_data: { destination: stripeDest! },
    };
    if (applicationFeeCents > 0) {
      piParams.application_fee_amount = applicationFeeCents;
    }

    try {
      const pi = await stripe!.paymentIntents.create(piParams, {
        idempotencyKey: `custos_dest_pi_${transactionId}`.slice(0, 255),
      });

      if (pi.status === "succeeded") {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: "settled",
            settledAt: new Date(),
            payoutStatus: "succeeded",
            payoutProvider: "stripe_connect_destination",
            payoutExternalId: pi.id,
            payoutError: null,
            payoutAttemptedAt: new Date(),
          },
        });
        await pushAudit({
          type: "payout",
          action: "Stripe Connect destination charge succeeded",
          actor: "stripe",
          detail: pi.id,
        });
      } else {
        const msg = `PaymentIntent status ${pi.status}${pi.last_payment_error?.message ? `: ${pi.last_payment_error.message}` : ""}`;
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            payoutStatus: "failed",
            payoutProvider: "stripe_connect_destination",
            payoutExternalId: pi.id,
            payoutError: msg.slice(0, 2000),
            payoutAttemptedAt: new Date(),
          },
        });
        await pushAudit({
          type: "payout",
          action: "Stripe Connect destination charge incomplete",
          actor: "stripe",
          detail: msg.slice(0, 800),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          payoutStatus: "failed",
          payoutProvider: "stripe_connect_destination",
          payoutError: msg.slice(0, 2000),
          payoutAttemptedAt: new Date(),
        },
      });
      await pushAudit({
        type: "payout",
        action: "Stripe Connect destination charge failed",
        actor: "stripe",
        detail: msg.slice(0, 800),
      });
    }
    return;
  }

  const canTryStripe =
    Boolean(stripeDest) &&
    stripeEnabled() &&
    stripe &&
    stripeRailOk;

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
