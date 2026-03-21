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
import { fundWallet } from "@/lib/api/wallets";
import { addFundsSchema, type AddFundsValues } from "@/lib/validators/fund";
import { Badge } from "@/components/ui/badge";

interface AddFundsModalProps {
  walletId: string;
  walletName?: string;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VENMO_USERNAME = "carlos-custos";
const PAYMENT_REFERENCE = "Custos wallet funding - include wallet ID in note";

export function AddFundsModal({
  walletId,
  currency,
  open,
  onOpenChange,
}: AddFundsModalProps) {
  const queryClient = useQueryClient();
  const form = useForm<AddFundsValues>({
    resolver: zodResolver(addFundsSchema),
    defaultValues: { amount: 0, reference: "" },
  });

  const fundMutation = useMutation({
    mutationFn: (body: { amount: number; reference?: string }) =>
      fundWallet(walletId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      onOpenChange(false);
      form.reset();
    },
  });

  function onSubmit(values: AddFundsValues) {
    fundMutation.mutate({
      amount: values.amount,
      reference: values.reference,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Add funds</DialogTitle>
            <Badge variant="secondary">Testing Mode</Badge>
          </div>
          <p className="text-caption text-muted-foreground">
            Funding instructions for the prototype environment. Real payment rails can be connected later.
          </p>
        </DialogHeader>

        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ({currency})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Memo for records" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-caption font-medium text-amber-800 dark:text-amber-200">
                  Testing Mode
                </p>
                <p className="mt-1 text-body-sm text-amber-700 dark:text-amber-300">
                  In the prototype, funding is managed via the instructions below. No real payment is processed.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-body-sm text-muted-foreground">Venmo:</span>
                  <code className="rounded bg-muted px-2 py-0.5 text-sm">{VENMO_USERNAME}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(VENMO_USERNAME)}
                  >
                    Copy
                  </Button>
                </div>
                <div className="mt-2">
                  <p className="text-caption text-muted-foreground">Payment reference (copy and include in Venmo note):</p>
                  <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-caption">
                    {PAYMENT_REFERENCE} — {walletId}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${PAYMENT_REFERENCE} — ${walletId}`
                      )
                    }
                  >
                    Copy reference
                  </Button>
                </div>
                <div className="mt-3 flex h-24 items-center justify-center rounded border border-border bg-muted/50">
                  <span className="text-caption text-muted-foreground">
                    QR code placeholder — replace with asset when available
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={fundMutation.isPending}>
                  {fundMutation.isPending ? "Recording…" : "Record funding"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
