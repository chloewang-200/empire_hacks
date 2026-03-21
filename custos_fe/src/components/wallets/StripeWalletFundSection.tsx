"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fundWallet } from "@/lib/api/wallets";
import { refreshWalletBalances } from "@/lib/refreshWalletBalances";

export function StripeWalletFundSection({
  embedded = false,
  walletId,
  currency,
  onComplete,
}: {
  embedded?: boolean;
  walletId: string;
  currency: string;
  onComplete?: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: async (value: number) => fundWallet(walletId, { amount: value }),
    onSuccess: async () => {
      await refreshWalletBalances(queryClient, walletId);
      onComplete?.();
    },
  });

  const parsed = Number(amount);
  const isValid = Number.isFinite(parsed) && parsed > 0;

  return (
    <div className={embedded ? "space-y-4" : ""}>
      <p className="text-sm text-muted-foreground">
        Mock card top-up flow for {currency.toUpperCase()}.
      </p>
      <div className="space-y-2">
        <Label htmlFor="stripe-fund-amount">Amount</Label>
        <Input
          id="stripe-fund-amount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </div>
      {mutation.isError ? (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Could not add funds"}
        </p>
      ) : null}
      <Button
        type="button"
        className="w-full"
        disabled={mutation.isPending || !isValid}
        onClick={() => mutation.mutate(parsed)}
      >
        {mutation.isPending ? "Applying..." : "Add funds by card"}
      </Button>
    </div>
  );
}
