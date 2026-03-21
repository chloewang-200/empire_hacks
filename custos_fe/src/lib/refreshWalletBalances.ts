import type { QueryClient } from "@tanstack/react-query";

export async function refreshWalletBalances(
  queryClient: QueryClient,
  walletId?: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["wallets"] }),
    walletId
      ? queryClient.invalidateQueries({ queryKey: ["wallets", walletId] })
      : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  ]);
}
