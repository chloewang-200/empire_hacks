"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useQueryClient } from "@tanstack/react-query";
import { createWalletFundIntent } from "@/lib/api/wallets";
import { refreshWalletBalances } from "@/lib/refreshWalletBalances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = pk ? loadStripe(pk) : null;

const MIN_AMOUNT = 0.5;

function StripeConfirm({
  walletId,
  amountLabel,
  onSuccess,
}: {
  walletId: string;
  amountLabel: string;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMsg(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/wallets/${walletId}?funded=1`,
      },
      redirect: "if_required",
    });
    if (error) {
      setMsg(error.message ?? "Payment failed");
      setBusy(false);
      return;
    }
    await refreshWalletBalances(queryClient, walletId);
    setBusy(false);
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Processing…" : `Pay ${amountLabel}`}
      </Button>
    </form>
  );
}

/**
 * Single card flow: amount → Stripe Payment Element (handles card brand, wallets, Link, etc.).
 * No separate “Pay with Visa” list — that’s redundant with Stripe’s UI.
 */
export function StripeWalletFundSection({
  walletId,
  currency,
  onComplete,
  embedded = false,
}: {
  walletId: string;
  currency: string;
  onComplete?: () => void;
  embedded?: boolean;
}) {
  const [step, setStep] = useState<"amount" | "pay">("amount");
  const [amount, setAmount] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const currencyCode = currency.length === 3 ? currency.toUpperCase() : "USD";
  const parsed = parseFloat(amount);
  const amountValid = !Number.isNaN(parsed) && parsed >= MIN_AMOUNT;
  const payLabel = amountValid
    ? new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(parsed)
    : "";

  async function handleContinue() {
    setFormError(null);
    if (!amountValid) {
      setFormError(`Enter an amount of at least ${MIN_AMOUNT} ${currencyCode}.`);
      return;
    }

    setIntentLoading(true);
    try {
      const data = await createWalletFundIntent(walletId, { amount: parsed });
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setStep("pay");
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setIntentLoading(false);
    }
  }

  function handleBack() {
    setStep("amount");
    setClientSecret(null);
    setFormError(null);
  }

  if (!stripePromise) {
    return (
      <p className="text-sm text-muted-foreground">
        Card payments are not fully configured. Ask your administrator to complete the payment setup for this
        workspace.
      </p>
    );
  }

  if (step === "amount") {
    return (
      <div className="space-y-4">
        {!embedded && (
          <div>
            <h3 className="text-base font-semibold text-foreground">Pay with card</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter an amount, then confirm payment — card number, wallet, or bank details are collected securely
              by Stripe.
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="fund-amt">Amount</Label>
          <Input
            id="fund-amt"
            type="number"
            step="0.01"
            min={MIN_AMOUNT}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10.00"
            autoComplete="transaction-amount"
          />
          <p className="mt-1.5 text-caption text-muted-foreground">
            Minimum {MIN_AMOUNT} {currencyCode}.
          </p>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button
          type="button"
          className="w-full bg-indigo-600 text-white hover:bg-indigo-600/90"
          disabled={intentLoading}
          onClick={() => void handleContinue()}
        >
          {intentLoading ? "Preparing…" : "Continue to payment"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" className="w-full" onClick={handleBack}>
        Back
      </Button>

      <p className="text-sm text-muted-foreground">
        Amount <span className="font-medium text-foreground">{payLabel}</span>
      </p>

      {clientSecret && stripePromise && (
        <Elements
          key={clientSecret}
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#4F46E5",
                borderRadius: "10px",
              },
            },
          }}
        >
          <StripeConfirm
            walletId={walletId}
            amountLabel={payLabel || `${parsed.toFixed(2)} ${currencyCode}`}
            onSuccess={() => onComplete?.()}
          />
        </Elements>
      )}
    </div>
  );
}
