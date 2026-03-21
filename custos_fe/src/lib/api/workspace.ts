import { apiGet, apiPatch } from "./client";

export type WorkspaceSpendMode = "STRIPE_TEST" | "MANUAL_REAL";

/** How you prefer to cover spend by default — does not remove any funding rail. */
export type WorkspaceFundingPreference = "BALANCE_FIRST" | "CARD_AT_SPEND" | "BOTH";

export interface WorkspaceInfo {
  id: string;
  name: string;
  spendMode: WorkspaceSpendMode;
  /** Present after backend supports funding preference; treat missing as BOTH. */
  fundingPreference?: WorkspaceFundingPreference;
}

export async function getWorkspace(): Promise<WorkspaceInfo> {
  return apiGet<WorkspaceInfo>("/api/workspace");
}

export async function patchWorkspace(
  body: Partial<{ spendMode: WorkspaceSpendMode; fundingPreference: WorkspaceFundingPreference }>
): Promise<WorkspaceInfo> {
  return apiPatch<WorkspaceInfo>("/api/workspace", body);
}
