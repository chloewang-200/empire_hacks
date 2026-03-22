"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useQueryClient } from "@tanstack/react-query";
import { createWalletSetupIntent, setWalletDefaultPaymentMethod } from "@/lib/api/wallets";
import { refreshWalletBalances } from "@/lib/refreshWalletBalances";
import { Button } from "@/components/ui/button";

const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = pk ? loadStripe(pk) : null;

function SetupConfirmForm({
  walletId,
  onComplete,
}: {
  walletId: string;
  onComplete: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setMsg(null);

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/wallets/${walletId}?card_on_file=1`,
      },
      redirect: "if_required",
    });

    if (error) {
      setMsg(error.message ?? "Setup failed");
      setBusy(false);
      return;
    }

    const pm = setupIntent?.payment_method;
    const paymentMethodId =
      typeof pm === "string"
        ? pm
        : pm && typeof pm === "object" && "id" in pm
          ? String((pm as { id: string }).id)
          : null;

    if (!paymentMethodId) {
      setMsg("No payment method returned. If a new tab opened, finish there and refresh this page.");
      setBusy(false);
      return;
    }

    try {
      await setWalletDefaultPaymentMethod(walletId, { paymentMethodId });
      await refreshWalletBalances(queryClient, walletId);
      onComplete();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save default card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
      <Button type="submit" disabled={!stripe || busy} className="w-full">
        {busy ? "Saving…" : "Save card for payouts"}
      </Button>
    </form>
  );
}

/**
 * SetupIntent + default PM for wallets with fundingModel connect_destination.
 * Separate from top-up: Add funds increases balance; this saves a card for off-session destination charges.
 */
export function StripeConnectCardSetupSection({
  walletId,
  hasDefaultPaymentMethod,
}: {
  walletId: string;
  hasDefaultPaymentMethod: boolean;
}) {
  const [step, setStep] = useState<"intro" | "form">("intro");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startSetup = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const data = await createWalletSetupIntent(walletId);
      if (!data.clientSecret) throw new Error("No client secret from server");
      setClientSecret(data.clientSecret);
      setStep("form");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start card setup");
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  if (!stripePromise) {
    return (
      <p className="text-sm text-muted-foreground">
        Stripe publishable key is not configured — card setup is unavailable.
      </p>
    );
  }

  if (hasDefaultPaymentMethod) {
    return (
      <p className="text-sm text-emerald-800 dark:text-emerald-300">
        A default card is on file. When auto-payout runs on this wallet, Custos can charge it for Connect
        destination payments (card-at-spend mode).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {step === "intro" ? (
        <>
          <p className="text-sm text-muted-foreground">
            <strong>Add funds</strong> only tops up your ledger balance. This wallet is set to{" "}
            <strong>charge a saved card per payout</strong> (Connect destination). You still need to save a card
            here so approved payouts can run.
          </p>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
          <Button type="button" onClick={() => void startSetup()} disabled={loading}>
            {loading ? "Preparing…" : "Save card for payouts"}
          </Button>
        </>
      ) : null}

      {step === "form" && clientSecret ? (
        <div className="space-y-3">
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setStep("intro");
            setClientSecret(null);
            setErr(null);
          }}>
            Back
          </Button>
          <Elements
            key={clientSecret}
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: { colorPrimary: "#4F46E5", borderRadius: "10px" },
              },
            }}
          >
            <SetupConfirmForm
              walletId={walletId}
              onComplete={() => {
                setStep("intro");
                setClientSecret(null);
              }}
            />
          </Elements>
        </div>
      ) : null}
    </div>
  );
}
