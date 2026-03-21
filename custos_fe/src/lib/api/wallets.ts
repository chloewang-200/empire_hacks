import type { Wallet, PaginatedResponse } from "@/lib/types";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client";

export async function getWallets(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
}): Promise<PaginatedResponse<Wallet>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
  if (params?.status) search.set("status", params.status);
  const q = search.toString();
  return apiGet<PaginatedResponse<Wallet>>(`/api/wallets${q ? `?${q}` : ""}`);
}

export async function getWallet(id: string): Promise<Wallet> {
  return apiGet<Wallet>(`/api/wallets/${id}`);
}

export interface CreateWalletBody {
  name: string;
  currency: string;
  fundingModel?: "prefund" | "connect_destination";
  policy: {
    approvalMode: string;
    limits: { daily?: number; perTransaction?: number };
    allowedCategories?: string[];
    allowedVendors?: string[];
    restrictedVendors?: string[];
    requireApprovedPayee?: boolean;
    autoExecutePayout?: boolean;
    allowedPayoutRails?: string[];
  };
  status?: string;
  notes?: string;
}

export async function createWallet(body: CreateWalletBody): Promise<Wallet> {
  return apiPost<Wallet>("/api/wallets", body);
}

export async function updateWallet(id: string, body: Partial<CreateWalletBody>): Promise<Wallet> {
  return apiPatch<Wallet>(`/api/wallets/${id}`, body);
}

export async function deleteWallet(id: string): Promise<void> {
  await apiDelete(`/api/wallets/${id}`);
}

export interface FundWalletBody {
  amount: number;
  reference?: string;
}

export async function fundWallet(walletId: string, body: FundWalletBody): Promise<Wallet> {
  return apiPost<Wallet>(`/api/wallets/${walletId}/fund`, body);
}

/** Stripe PaymentIntent for wallet top-up (STRIPE_TEST workspace mode only). */
export async function createWalletFundIntent(
  walletId: string,
  body: { amount: number }
): Promise<{ clientSecret: string | null; paymentIntentId: string }> {
  return apiPost(`/api/wallets/${walletId}/fund/intent`, body);
}

export async function ensureWalletStripeCustomer(
  walletId: string
): Promise<{ stripeCustomerId: string }> {
  return apiPost(`/api/wallets/${walletId}/stripe/customer`, {});
}

export async function createWalletSetupIntent(walletId: string): Promise<{
  clientSecret: string | null;
  setupIntentId: string;
  stripeCustomerId: string;
}> {
  return apiPost(`/api/wallets/${walletId}/stripe/setup-intent`, {});
}

export async function setWalletDefaultPaymentMethod(
  walletId: string,
  body: { paymentMethodId: string }
): Promise<Wallet> {
  return apiPost(`/api/wallets/${walletId}/stripe/default-payment-method`, body);
}

/** Carlos / manual workspace: credit wallet after secret code (server-side env). */
export async function fundCarlosManual(
  walletId: string,
  body: { amount: number; secretCode: string }
): Promise<Wallet> {
  return apiPost<Wallet>(`/api/wallets/${walletId}/fund/carlos`, body);
}

export async function getWalletTransactions(walletId: string, params?: { page?: number }): Promise<PaginatedResponse<import("@/lib/types").Transaction>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  const q = search.toString();
  return apiGet(`/api/wallets/${walletId}/transactions${q ? `?${q}` : ""}`);
}
