"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTransaction } from "@/lib/api/transactions";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionAuditPanel } from "@/components/transactions/TransactionAuditPanel";

interface TransactionDetailSheetProps {
  transactionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailSheet({
  transactionId,
  open,
  onOpenChange,
}: TransactionDetailSheetProps) {
  const { data: tx, isLoading } = useQuery({
    queryKey: ["transactions", transactionId],
    queryFn: () => getTransaction(transactionId),
    enabled: open && !!transactionId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose
        className={cn(
          "flex w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full sm:rounded-xl",
          "max-h-[min(92vh,880px)]"
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 pr-14 text-left">
          <DialogTitle>Transaction audit</DialogTitle>
          {tx && (
            <p className="text-sm font-normal text-muted-foreground">
              {formatCurrency(tx.amount, tx.currency)} · {formatDateTime(tx.requestedAt)}
            </p>
          )}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {isLoading || !tx ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <TransactionAuditPanel tx={tx} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
