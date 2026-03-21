import type { QueryClient } from "@tanstack/react-query";

/** Delayed refetches — webhook may credit the wallet shortly after Stripe returns success. */
function scheduleDelayedRefetch(queryClient: QueryClient, walletId: string) {
  const refetch = () => {
    void queryClient.refetchQueries({ queryKey: ["wallets", walletId] });
    void queryClient.refetchQueries({ queryKey: ["wallets"] });
  };
  setTimeout(refetch, 2000);
  setTimeout(refetch, 5000);
}

/** Invalidate + refetch wallet list/detail so balance updates without a full page reload. */
export async function refreshWalletBalances(queryClient: QueryClient, walletId?: string) {
  await queryClient.invalidateQueries({ queryKey: ["wallets"] });
  await queryClient.invalidateQueries({ queryKey: ["transactions"] });
  if (walletId) {
    await queryClient.invalidateQueries({ queryKey: ["wallets", walletId] });
  }
  if (walletId) {
    await queryClient.refetchQueries({ queryKey: ["wallets", walletId] });
  }
  await queryClient.refetchQueries({ queryKey: ["wallets"] });
  if (walletId) {
    scheduleDelayedRefetch(queryClient, walletId);
  }
}
