"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getTransaction } from "@/lib/api/transactions";
import { formatCurrency, formatDateTime } from "@/lib/utils";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle>Transaction audit</SheetTitle>
          {tx && (
            <p className="text-left text-sm font-normal text-muted-foreground">
              {formatCurrency(tx.amount, tx.currency)} · {formatDateTime(tx.requestedAt)}
            </p>
          )}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pt-4">
          {isLoading || !tx ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <TransactionAuditPanel tx={tx} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
