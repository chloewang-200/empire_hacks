import type { ApprovedPayee } from "@/lib/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "./client";

export async function getPayees(): Promise<ApprovedPayee[]> {
  const r = await apiGet<{ data: ApprovedPayee[] }>("/api/payees");
  return r.data;
}

export async function createPayee(body: {
  displayName: string;
  legalName?: string;
  aliases?: string[];
  defaultRail?: string;
  paymentInstructions?: string;
  stripeConnectAccountId?: string;
  notes?: string;
  active?: boolean;
}): Promise<ApprovedPayee> {
  return apiPost<ApprovedPayee>("/api/payees", body);
}

export async function updatePayee(
  id: string,
  body: Partial<{
    displayName: string;
    legalName: string | null;
    aliases: string[];
    defaultRail: string;
    paymentInstructions: string | null;
    stripeConnectAccountId: string | null;
    notes: string | null;
    active: boolean;
  }>
): Promise<ApprovedPayee> {
  return apiPatch<ApprovedPayee>(`/api/payees/${id}`, body);
}

export async function deletePayee(id: string): Promise<void> {
  await apiDelete(`/api/payees/${id}`);
}
