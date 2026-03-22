"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWorkspace } from "@/lib/api/workspace";
import { fundingPreferenceSubtitle } from "@/lib/fundingPreference";
import { fundCarlosManual } from "@/lib/api/wallets";
import { refreshWalletBalances } from "@/lib/refreshWalletBalances";
import { StripeWalletFundSection } from "@/components/wallets/StripeWalletFundSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BankRailLogo,
  CardRailLogo,
  CarlosRailLogo,
  CryptoRailLogo,
  Pay402RailLogo,
} from "@/components/wallets/FundingRailLogos";

interface AddFundsModalProps {
  walletId: string;
  walletName?: string;
  currency: string;
  /** Shown when card-at-spend: top-up ≠ saving a card for payouts */
  fundingModel?: "prefund" | "connect_destination";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Rail = "card" | "carlos" | "bank" | "crypto" | "pay402";

const RAILS: {
  id: Rail;
  title: string;
  description: string;
  Logo: () => ReactNode;
  badge?: "soon";
}[] = [
  {
    id: "card",
    title: "Card",
    description: "Debit, credit, Apple Pay, Link — one checkout flow.",
    Logo: CardRailLogo,
  },
  {
    id: "carlos",
    title: "Manual / Carlos",
    description: "Treasury and reconciliation handled by your team outside the app.",
    Logo: CarlosRailLogo,
  },
  {
    id: "bank",
    title: "Bank (ACH / wire)",
    description: "Connect bank or wire instructions to fund this wallet.",
    Logo: BankRailLogo,
    badge: "soon",
  },
  {
    id: "crypto",
    title: "Crypto",
    description: "Deposit on-chain and credit after confirmations.",
    Logo: CryptoRailLogo,
    badge: "soon",
  },
  {
    id: "pay402",
    title: "HTTP 402 pay-in",
    description: "Fund when an integration returns Payment Required.",
    Logo: Pay402RailLogo,
    badge: "soon",
  },
];

const MIN_CARLOS_AMOUNT = 0.5;

function CarlosManualFundForm({
  walletId,
  currency,
  onCredited,
}: {
  walletId: string;
  currency: string;
  onCredited: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [secretCode, setSecretCode] = useState("");

  const mutation = useMutation({
    mutationFn: (body: { amount: number; secretCode: string }) => fundCarlosManual(walletId, body),
    onSuccess: async () => {
      await refreshWalletBalances(queryClient, walletId);
      onCredited();
    },
  });

  const currencyCode = currency.length === 3 ? currency.toUpperCase() : "USD";
  const parsed = parseFloat(amount);
  const amountValid = !Number.isNaN(parsed) && parsed >= MIN_CARLOS_AMOUNT;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Treasury / ops credit. Enter the secret code your team provided — it is not shown here.
      </p>

      <div>
        <Label htmlFor="carlos-amt">Amount ({currencyCode})</Label>
        <Input
          id="carlos-amt"
          type="number"
          step="0.01"
          min={MIN_CARLOS_AMOUNT}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          autoComplete="transaction-amount"
        />
        <p className="mt-1 text-caption text-muted-foreground">Minimum {MIN_CARLOS_AMOUNT} {currencyCode}.</p>
      </div>
      <div>
        <Label htmlFor="carlos-code">Secret code</Label>
        <Input
          id="carlos-code"
          type="password"
          value={secretCode}
          onChange={(e) => setSecretCode(e.target.value)}
          placeholder="Secret code"
          autoComplete="off"
        />
      </div>
      {mutation.isError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : "Could not add funds"}
        </p>
      )}
      <Button
        type="button"
        className="w-full bg-indigo-600 text-white hover:bg-indigo-600/90"
        disabled={mutation.isPending || !amountValid || !secretCode.trim()}
        onClick={() => mutation.mutate({ amount: parsed, secretCode: secretCode.trim() })}
      >
        {mutation.isPending ? "Applying…" : "Add funds"}
      </Button>
    </div>
  );
}

export function AddFundsModal({
  walletId,
  currency,
  fundingModel = "prefund",
  open,
  onOpenChange,
}: AddFundsModalProps) {
  const [rail, setRail] = useState<Rail>("card");

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: getWorkspace,
    enabled: open,
  });

  useEffect(() => {
    if (open) setRail("card");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,800px)] flex-col gap-4 overflow-hidden sm:max-w-xl sm:p-7">
        <DialogHeader className="shrink-0">
          <DialogTitle>Add funds</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {workspace
              ? fundingPreferenceSubtitle(workspace.fundingPreference ?? "BOTH")
              : "Top up this wallet — card, treasury credit, or other rails."}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-2.5 py-1.5 [-webkit-overflow-scrolling:touch]">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Funding method</p>
            <div className="space-y-2" role="radiogroup" aria-label="Funding option">
                  {RAILS.map((r) => {
                    const selected = rail === r.id;
                    const Logo = r.Logo;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setRail(r.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors hover:bg-muted/40",
                          selected
                            ? "border-indigo-500 bg-indigo-500/[0.06] ring-1 ring-indigo-500/35"
                            : "border-border"
                        )}
                      >
                        <Logo />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{r.title}</span>
                            {r.badge === "soon" && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                                Coming soon
                              </Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{r.description}</span>
                        </span>
                        {selected && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                {rail === "card" && fundingModel === "connect_destination" && (
                  <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                    This wallet uses <strong>card-at-spend</strong> for Connect payouts. <strong>Add funds</strong>{" "}
                    tops up your balance only. To fix “saved payment method required”, close this modal and use{" "}
                    <strong>Card for Connect payouts</strong> on the wallet page.
                  </p>
                )}
                {rail === "card" && (
                  <StripeWalletFundSection
                    embedded
                    walletId={walletId}
                    currency={currency}
                    onComplete={() => onOpenChange(false)}
                  />
                )}

                {rail === "carlos" && (
                  <div className="space-y-3">
                    <p className="text-base font-medium text-foreground">Manual / Carlos</p>
                    <CarlosManualFundForm
                      walletId={walletId}
                      currency={currency}
                      onCredited={() => onOpenChange(false)}
                    />
                  </div>
                )}

                {rail === "bank" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Bank (ACH / wire)</p>
                    <p>
                      Connect Plaid or display wire instructions and reconcile deposits to this wallet. This path is
                      not available yet.
                    </p>
                  </div>
                )}

                {rail === "crypto" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Crypto (on-chain)</p>
                    <p>
                      Show a deposit address, network, and confirmation depth before crediting the wallet. Coming
                      in a future release.
                    </p>
                  </div>
                )}

                {rail === "pay402" && (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">HTTP 402 Payment Required</p>
                    <p>
                      Pair automatic top-ups or invoices with APIs that return{" "}
                      <code className="rounded bg-muted px-1">402</code> when funds are required. Planned for a future
                      release.
                    </p>
                  </div>
                )}
              </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
