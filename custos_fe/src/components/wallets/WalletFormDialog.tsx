"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWallet, updateWallet } from "@/lib/api/wallets";
import { walletFormSchema, type WalletFormValues } from "@/lib/validators/wallet";
import { APPROVAL_MODES } from "@/lib/constants";
import type { WalletPolicy } from "@/lib/types";

interface WalletFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId?: string;
  /** When editing, merge so policy fields not in the form are preserved server-side. */
  existingPolicy?: WalletPolicy;
  defaultValues?: Partial<WalletFormValues>;
}

export function WalletFormDialog({
  open,
  onOpenChange,
  walletId,
  existingPolicy,
  defaultValues,
}: WalletFormDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: {
      name: "",
      currency: "USD",
      fundingModel: defaultValues?.fundingModel ?? "prefund",
      dailyLimit: defaultValues?.dailyLimit,
      perTransactionLimit: defaultValues?.perTransactionLimit,
      allowedCategories: defaultValues?.allowedCategories ?? [],
      approvalMode: "review",
      requireApprovedPayee: defaultValues?.requireApprovedPayee ?? false,
      autoExecutePayout: defaultValues?.autoExecutePayout ?? false,
      allowedPayoutRailsText: defaultValues?.allowedPayoutRailsText ?? "",
      status: "active",
      ...defaultValues,
    },
  });

  useEffect(() => {
    if (!open || walletId) return;
    form.reset({
      name: "",
      currency: "USD",
      fundingModel: "prefund",
      dailyLimit: undefined,
      perTransactionLimit: undefined,
      allowedCategories: [],
      approvalMode: "review",
      requireApprovedPayee: false,
      autoExecutePayout: false,
      allowedPayoutRailsText: "",
      status: "active",
      notes: undefined,
    });
  }, [open, walletId, form]);

  const saveMutation = useMutation({
    mutationFn: (body: Parameters<typeof createWallet>[0]) =>
      walletId ? updateWallet(walletId, body) : createWallet(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      if (walletId) queryClient.invalidateQueries({ queryKey: ["wallets", walletId] });
      onOpenChange(false);
      form.reset();
    },
  });

  function onSubmit(values: WalletFormValues) {
    const rails = values.allowedPayoutRailsText
      ? values.allowedPayoutRailsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const body = {
      name: values.name,
      currency: values.currency,
      fundingModel: values.fundingModel,
      policy: {
        approvalMode: values.approvalMode,
        limits: {
          daily: values.dailyLimit,
          perTransaction: values.perTransactionLimit,
        },
        allowedCategories: values.allowedCategories,
        allowedVendors: existingPolicy?.allowedVendors,
        restrictedVendors: existingPolicy?.restrictedVendors,
        requireApprovedPayee: values.requireApprovedPayee === true,
        autoExecutePayout: values.autoExecutePayout === true,
        ...(rails && rails.length > 0 ? { allowedPayoutRails: rails } : {}),
      },
      status: values.status,
      notes: values.notes,
    };
    saveMutation.mutate(body);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{walletId ? "Edit wallet" : "Add wallet"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Operations Wallet" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fundingModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How payouts are funded</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose funding model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="prefund">
                        Prefund — top up balance; payouts use platform balance (Stripe transfer)
                      </SelectItem>
                      <SelectItem value="connect_destination">
                        Card on file — charge saved card per payout (Stripe Connect destination)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-caption text-muted-foreground">
                    Connect destination needs a saved card on this wallet and payees with{" "}
                    <code className="text-xs">acct_…</code>. You won&apos;t use &quot;Add funds&quot; for that model.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dailyLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily limit (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="perTransactionLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Per-transaction limit (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="approvalMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Approval mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {APPROVAL_MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireApprovedPayee"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-medium">Require approved payee (wallet-wide)</FormLabel>
                    <p className="text-caption text-muted-foreground">
                      When enabled here or on an agent, requests must match{" "}
                      <span className="font-medium text-foreground">Payees</span> or go to review. Prefer configuring
                      this per agent under <span className="font-medium text-foreground">Edit agent → Spend rules</span>
                      .
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="autoExecutePayout"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-medium">Auto-execute payout</FormLabel>
                    <p className="text-caption text-muted-foreground">
                      When policy approves, attempt payout: prefund wallets need balance + Stripe transfer; Connect
                      destination wallets charge the saved card to the payee&apos;s{" "}
                      <code className="text-xs">acct_…</code>. Venmo uses PayPal when configured.
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowedPayoutRailsText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowed payout rails (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. stripe_connect, merchant_card"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-caption text-muted-foreground">
                    If set, the agent&apos;s requested rail must match one of these (comma-separated). Leave empty for
                    any rail.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? walletId ? "Saving…" : "Creating…"
                  : walletId ? "Save" : "Create wallet"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
