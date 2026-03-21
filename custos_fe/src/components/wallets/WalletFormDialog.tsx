"use client";

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

interface WalletFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId?: string;
  defaultValues?: Partial<WalletFormValues>;
}

export function WalletFormDialog({
  open,
  onOpenChange,
  walletId,
  defaultValues,
}: WalletFormDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: {
      name: "",
      currency: "USD",
      balance: defaultValues?.balance ?? 0,
      dailyLimit: defaultValues?.dailyLimit,
      perTransactionLimit: defaultValues?.perTransactionLimit,
      allowedCategories: defaultValues?.allowedCategories ?? [],
      approvalMode: "review",
      status: "active",
      ...defaultValues,
    },
  });

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
    const body = {
      name: values.name,
      currency: values.currency,
      balance: values.balance,
      policy: {
        approvalMode: values.approvalMode,
        limits: {
          daily: values.dailyLimit,
          perTransaction: values.perTransactionLimit,
        },
        allowedCategories: values.allowedCategories,
        status: values.status,
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
            <div className="grid grid-cols-2 gap-4">
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
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial balance</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
