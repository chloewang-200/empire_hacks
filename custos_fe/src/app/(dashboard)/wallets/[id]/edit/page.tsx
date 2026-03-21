"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWallet } from "@/lib/api/wallets";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletFormDialog } from "@/components/wallets/WalletFormDialog";

export default function WalletEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [dialogOpen, setDialogOpen] = useState(true);
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["wallets", id],
    queryFn: () => getWallet(id),
  });

  if (isLoading || !wallet) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/wallets/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-heading-1">Edit wallet</h1>
      </div>
      <WalletFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) router.push(`/wallets/${id}`);
        }}
        walletId={id}
        defaultValues={{
          name: wallet.name,
          currency: wallet.currency,
          dailyLimit: wallet.policy?.limits?.daily,
          perTransactionLimit: wallet.policy?.limits?.perTransaction,
          approvalMode: wallet.policy?.approvalMode ?? "review",
          status: wallet.status,
        }}
      />
    </div>
  );
}
